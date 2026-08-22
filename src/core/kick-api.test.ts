import { beforeEach, describe, expect, it, vi } from "vitest";

type MockResponse = { status: number; statusText?: string; data: unknown };

const axiosGet = vi.hoisted(() =>
  vi.fn<(args: unknown[]) => Promise<MockResponse>>(async () => ({
    status: 200,
    data: {},
  })),
);

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign({}, actual.default, { get: axiosGet }),
  };
});

import { getChannelData, getVideoData } from "./kick-api";

describe("getChannelData", () => {
  beforeEach(() => {
    axiosGet.mockClear();
    axiosGet.mockResolvedValue({ status: 200, data: {} });
  });

  it("fetches and returns valid channel data", async () => {
    const payload = { id: 1, slug: "xqc", chatroom: { id: 51082 } };
    axiosGet.mockResolvedValue({ status: 200, data: payload });

    const result = await getChannelData("xqc");

    expect(result).toEqual(payload);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/channels/xqc",
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it("throws the Cloudflare message on 403", async () => {
    axiosGet.mockResolvedValue({ status: 403, data: "blocked" });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Request blocked by Cloudflare protection",
    );
  });

  it("includes the status for other non-2xx responses", async () => {
    axiosGet.mockResolvedValue({ status: 500, data: "oops" });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Failed to fetch channel data: received status 500",
    );
  });

  it("rejects HTML bodies served with a 200 (challenge pages)", async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      data: "<html>Just a moment...</html>",
    });

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Unexpected channel data response shape; Kick may have served a challenge page/,
    );
  });

  it("validates that chatroom.id exists for channel payloads", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { id: 1 } });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Unexpected channel data response shape",
    );
  });

  it("wraps network failures with the fetch label", async () => {
    axiosGet.mockRejectedValue(new Error("ECONNRESET"));

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Failed to fetch channel data: .*ECONNRESET/,
    );
  });
});

describe("getVideoData", () => {
  it("accepts payloads identified by uuid alone", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { uuid: "abc-123" } });

    const result = await getVideoData("abc-123");

    expect(result).toEqual({ uuid: "abc-123" });
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/video/abc-123",
      expect.anything(),
    );
  });

  it("rejects unrecognizable video payloads", async () => {
    axiosGet.mockClear();
    axiosGet.mockResolvedValue({ status: 200, data: { unrelated: true } });

    await expect(getVideoData("xyz")).rejects.toThrow(
      "Unexpected video data response shape",
    );
  });
});
