import { describe, expect, it } from "vitest";

import {
  buildSession,
  decodeXsrfToken,
  normalizeCookies,
  toCookieHeader,
  xsrfFromJar,
} from "./session";

describe("decodeXsrfToken", () => {
  it("decodes uri-encoded values and tolerates raw ones", () => {
    expect(decodeXsrfToken("a%2Fb%3Dc")).toBe("a/b=c");
    expect(decodeXsrfToken("plain-value")).toBe("plain-value");
  });
});

describe("normalizeCookies", () => {
  it("parses cookie-header strings keeping values verbatim", () => {
    const jar = normalizeCookies("session_token=abc; XSRF-TOKEN=a%2Fb; empty=");
    expect(jar).toEqual({
      session_token: "abc",
      "XSRF-TOKEN": "a%2Fb",
    });
  });

  it("copies maps as-is", () => {
    const input = { kick_session: "xyz" };
    const jar = normalizeCookies(input);
    expect(jar).toEqual(input);
    expect(jar).not.toBe(input);
  });

  it("returns an empty jar for missing input", () => {
    expect(normalizeCookies()).toEqual({});
    expect(normalizeCookies(undefined)).toEqual({});
  });

  it("skips malformed header fragments", () => {
    expect(normalizeCookies("novalue; =x; k=v")).toEqual({ k: "v" });
  });
});

describe("toCookieHeader", () => {
  it("round-trips a cookie header byte-for-byte", () => {
    const header =
      "session_token=abc; XSRF-TOKEN=enc%2Foded; kick_session=x.y.z";
    expect(toCookieHeader(normalizeCookies(header))).toBe(header);
  });

  it("serializes maps into a header", () => {
    expect(toCookieHeader({ a: "1", b: "2" })).toBe("a=1; b=2");
  });
});

describe("xsrfFromJar", () => {
  it("finds the xsrf cookie case-insensitively and decodes it once", () => {
    expect(xsrfFromJar({ "XSRF-TOKEN": "a%2Fb" })).toBe("a/b");
    expect(xsrfFromJar({ "xsrf-token": "raw=" })).toBe("raw=");
    expect(xsrfFromJar({ other: "value" })).toBeNull();
  });
});

describe("buildSession", () => {
  it("accepts explicit accessToken with string cookies", () => {
    const session = buildSession({
      accessToken: "token-123",
      cookies: "XSRF-TOKEN=x%2Fy",
    });
    expect(session.accessToken).toBe("token-123");
    expect(session.cookies["XSRF-TOKEN"]).toBe("x%2Fy");
    expect(typeof session.savedAt).toBe("string");
  });

  it("promotes from cookies when no accessToken is given", () => {
    const session = buildSession({
      cookies:
        "session_token=a-long-enough-session-token-value; XSRF-TOKEN=t%2Fx",
    });
    expect(session.accessToken).toBe("a-long-enough-session-token-value");
  });

  it("throws when cookies alone promote nothing", () => {
    expect(() =>
      buildSession({ cookies: { foo: "bar", "XSRF-TOKEN": "x" } }),
    ).toThrow(/Could not find a usable access token/);
  });

  it("promotes a bag into a session", () => {
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"e".repeat(30)}.sig`;
    const session = buildSession({
      bag: {
        __ls_access_token_bearer: token,
        theme: "dark",
        "XSRF-TOKEN": "t%2Fx",
      },
    });
    expect(session.accessToken).toBe(token);
    expect(session.cookies).toEqual({ theme: "dark", "XSRF-TOKEN": "t%2Fx" });
  });

  it("throws when a bag promotes nothing", () => {
    expect(() => buildSession({ bag: { csrf_token: "tiny" } })).toThrow(
      /Could not promote any token/,
    );
  });

  it("accepts sessions whose jar has no XSRF-TOKEN (it is optional)", () => {
    const session = buildSession({
      accessToken: "token-123",
      cookies: { foo: "bar" },
    });
    expect(session.accessToken).toBe("token-123");
    expect(session.cookies).toEqual({ foo: "bar" });

    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"e".repeat(30)}.sig`;
    expect(buildSession({ bag: { __ls_token: token } }).accessToken).toBe(
      token,
    );
  });

  it("rejects invalid input", () => {
    expect(() => buildSession({ accessToken: "" } as never)).toThrow(
      /accessToken must be a non-empty string/,
    );
    expect(() => buildSession(undefined as never)).toThrow(
      /Login requires credentials/,
    );
    expect(() => buildSession({} as never)).toThrow(
      /Login requires credentials/,
    );
  });
});
