import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRequestContext,
  DEFAULT_TIMEOUT_MS,
  HttpStatusError,
  isAuthExpiredError,
  makeRequest,
} from "./request-helper";

type MockResponse = { status: number; statusText?: string; data: unknown };

const axiosCall = vi.hoisted(() =>
  vi.fn<(args: unknown[]) => Promise<MockResponse>>(async () => ({
    status: 200,
    data: { ok: true },
  })),
);

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(axiosCall, actual.default),
  };
});

import { AxiosHeaders } from "axios";
import { type KickSession } from "../auth/session";

const session = (): KickSession => ({
  accessToken: "tok-123",
  cookies: { "XSRF-TOKEN": "a%2Fb", session_token: "st-456" },
  savedAt: "2026-01-01T00:00:00.000Z",
});

describe("createHeaders", () => {
  it("sets credentials, xsrf, app-platform and fingerprint headers", () => {
    const headers = createRequestContext({
      session: session(),
      channelSlug: "xqc",
    }).headers;

    expect(headers.get("authorization")).toBe("Bearer tok-123");
    expect(headers.get("cookie")).toBe(
      "XSRF-TOKEN=a%2Fb; session_token=st-456",
    );
    expect(headers.get("x-xsrf-token")).toBe("a/b");
    expect(headers.get("x-app-platform")).toBe("web");
    // Legacy headers the real browser does not send.
    expect(headers.get("cluster")).toBeUndefined();
    expect(headers.get("x-client-token")).toBeUndefined();
    expect(headers.get("referrer-policy")).toBeUndefined();
    expect(headers.get("sec-ch-ua")).toContain("Chromium");
    expect(headers.get("sec-fetch-site")).toBe("same-origin");
    expect(headers.get("Referer")).toBe("https://kick.com/xqc");
    expect(headers).toBeInstanceOf(AxiosHeaders);
  });

  it("omits x-xsrf-token when the jar has no XSRF cookie (it is optional)", () => {
    const bare = { accessToken: "tok", cookies: { foo: "bar" } };
    const headers = createRequestContext({
      session: bare,
      channelSlug: "xqc",
    }).headers;

    expect(headers.get("x-xsrf-token")).toBeUndefined();
    expect(headers.get("authorization")).toBe("Bearer tok");
    expect(headers.get("cookie")).toBe("foo=bar");
  });
});

describe("createRequestContext", () => {
  it("defaults the timeout when omitted or invalid", () => {
    const base = { session: session(), channelSlug: "xqc" };

    expect(createRequestContext(base).timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(createRequestContext(base, 0).timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(createRequestContext(base, -5).timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("passes through positive custom timeouts", () => {
    expect(
      createRequestContext({ session: session(), channelSlug: "xqc" }, 2500)
        .timeoutMs,
    ).toBe(2500);
  });
});

describe("HttpStatusError / isAuthExpiredError", () => {
  it("only treats 401 as auth expiry", () => {
    expect(isAuthExpiredError(new HttpStatusError(401, "Unauthorized"))).toBe(
      true,
    );
    expect(isAuthExpiredError(new HttpStatusError(403, "Forbidden"))).toBe(
      false,
    );
    expect(isAuthExpiredError(new Error("nope"))).toBe(false);
    expect(isAuthExpiredError(null)).toBe(false);
  });

  it("carries the status and a clean message", () => {
    const error = new HttpStatusError(429, "");
    expect(error.status).toBe(429);
    expect(error.message).toBe("Request failed with status: 429");
    expect(error.name).toBe("HttpStatusError");
  });

  it("appends a truncated body snippet and exposes the raw body", () => {
    const message = "x".repeat(300);
    const error = new HttpStatusError(403, "Forbidden", {
      body: { message },
    });
    expect(error.body).toEqual({ message });
    const snippet = JSON.stringify({ message: "x".repeat(200) }).slice(0, 200);
    expect(error.message).toBe(
      `Request failed with status: 403 Forbidden — ${snippet}…`,
    );

    const empty = new HttpStatusError(500, "", { body: "" });
    expect(empty.message).toBe("Request failed with status: 500");
    expect(empty.body).toBe("");
  });
});

describe("makeRequest", () => {
  beforeEach(() => {
    axiosCall.mockClear();
    axiosCall.mockResolvedValue({ status: 200, data: { ok: true } });
  });

  it("returns parsed data on success and forwards timeout + headers", async () => {
    const context = createRequestContext(
      { session: session(), channelSlug: "xqc" },
      1234,
    );

    const result = await makeRequest<{ ok: boolean }>(
      "post",
      "https://kick.com/api/v2/x",
      context,
      { a: 1 },
    );

    expect(result).toEqual({ ok: true });
    expect(axiosCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "https://kick.com/api/v2/x",
        headers: context.headers,
        timeout: 1234,
        data: { a: 1 },
      }),
    );
  });

  it("throws HttpStatusError with the status on non-2xx", async () => {
    axiosCall.mockResolvedValue({ status: 403, statusText: "", data: "" });

    await expect(
      makeRequest("get", "https://kick.com/x", {
        headers: new AxiosHeaders(),
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({
      name: "HttpStatusError",
      status: 403,
    });
  });
});
