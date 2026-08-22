import { describe, expect, it } from "vitest";

import {
  bagCookies,
  isJwtLike,
  promoteSession,
  promoteToken,
  TOKEN_NAMES,
} from "./promote";

const bag = (entries: [string, string][]) =>
  Object.fromEntries(entries) as Record<string, string>;

const jwt = (payload: string) => {
  // A long enough JWT-shaped token (header.payload.signature).
  const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const signature = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  return `${header}.${payload}.${signature}`;
};

describe("isJwtLike", () => {
  it("detects jwt-shaped values", () => {
    expect(
      isJwtLike(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      ),
    ).toBe(true);
    expect(isJwtLike("not-a-jwt")).toBe(false);
  });
});

describe("promoteToken", () => {
  it("prefers cookie name over storage prefix", () => {
    const cookie = jwt("eyJuYW1lIjoiYWxpY2UifQ");
    const storage = jwt("eyJuYW1lIjoiYm9ifQ");
    const b = bag([
      ["__ls_access_token", storage],
      ["session_token", cookie],
    ]);
    expect(promoteToken(b, TOKEN_NAMES)).toBe(cookie);
  });

  it("falls back to prefixed storage", () => {
    const storage = jwt("eyJuYW1lIjoiY2Fyb2x9");
    const b = bag([["__ss_access_token", storage]]);
    expect(promoteToken(b, TOKEN_NAMES)).toBe(storage);
  });

  it("falls back to any jwt value", () => {
    const token = jwt("eyJuYW1lIjoiZGF2ZX0");
    const b = bag([["track-access-token", token]]);
    expect(promoteToken(b, TOKEN_NAMES)).toBe(token);
  });

  it("falls back to long opaque values", () => {
    const opaque = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEFGHIJKLMNOP";
    const b = bag([["kick_session", opaque]]);
    expect(promoteToken(b, TOKEN_NAMES)).toBe(opaque);
  });

  it("ignores csrf values in the last tier", () => {
    const opaque = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEFGHIJKLMNOP";
    const b = bag([["XSRF-TOKEN", opaque]]);
    expect(promoteToken(b, TOKEN_NAMES)).toBeNull();
  });

  it("returns null for an empty bag", () => {
    expect(promoteToken({}, TOKEN_NAMES)).toBeNull();
  });
});

describe("bagCookies", () => {
  it("keeps unprefixed entries and strips storage prefixes", () => {
    const cookies = bagCookies(
      bag([
        ["session_token", "abc"],
        ["__ls_theme", "dark"],
        ["__ss_temp", "1"],
      ]),
    );
    expect(cookies).toEqual({ session_token: "abc" });
  });
});

describe("promoteSession", () => {
  it("builds a session with jar and savedAt", () => {
    const token = jwt("eyJsZXYiOjF9");
    const session = promoteSession(
      bag([
        ["session_token", token],
        ["XSRF-TOKEN", "opaque-xsrf-value"],
        ["__ls_ui", "something-long-enough"],
      ]),
    );

    expect(session).not.toBeNull();
    if (!session) return;
    expect(session.accessToken).toBe(token);
    expect(session.cookies).toEqual({
      session_token: token,
      "XSRF-TOKEN": "opaque-xsrf-value",
    });
    expect(typeof session.savedAt).toBe("string");
  });

  it("returns null when nothing promotes", () => {
    expect(promoteSession(bag([]))).toBeNull();
    expect(promoteSession(bag([["XSRF-TOKEN", "short"]]))).toBeNull();
  });
});
