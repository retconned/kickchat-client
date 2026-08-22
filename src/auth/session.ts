import { type LoginOptions } from "../types/client";
import { promoteSession, promoteToken } from "./promote";

export interface KickSession {
  accessToken: string;
  cookies: Record<string, string>;
  savedAt?: string;
}

export type CookieInput = Record<string, string> | string;

export const decodeXsrfToken = (token: string): string => {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

const XSRF_COOKIE_NAME = "xsrf-token";

export const normalizeCookies = (
  input?: CookieInput,
): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!input) {
    return cookies;
  }

  if (typeof input === "string") {
    for (const part of input.split(";")) {
      const separator = part.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (!name || !value) {
        continue;
      }
      cookies[name] = value;
    }
    return cookies;
  }

  for (const [name, value] of Object.entries(input)) {
    if (name && value) {
      cookies[name] = value;
    }
  }
  return cookies;
};

export const toCookieHeader = (cookies: Record<string, string>): string =>
  Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

export const xsrfFromJar = (cookies: Record<string, string>): string | null => {
  for (const [name, value] of Object.entries(cookies)) {
    if (name.toLowerCase() === XSRF_COOKIE_NAME) {
      return value ? decodeXsrfToken(value) : null;
    }
  }
  return null;
};

const assertNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

export const buildSession = (input: LoginOptions): KickSession => {
  if (!input || typeof input !== "object") {
    throw new Error(
      "Login requires credentials: { accessToken, cookies? }, { cookies }, or { bag }",
    );
  }

  if ("bag" in input) {
    const bag = input.bag;
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) {
      throw new Error("bag must be an object of name → value strings");
    }
    const session = promoteSession(bag);
    if (!session) {
      throw new Error(
        "Could not promote any token from the provided bag. Make sure it contains your Kick session cookie or a JWT-shaped token.",
      );
    }
    return session;
  }

  if ("accessToken" in input && input.accessToken !== undefined) {
    const accessToken = assertNonEmptyString(input.accessToken, "accessToken");
    const cookies = normalizeCookies(input.cookies);
    return {
      accessToken,
      cookies,
      savedAt: new Date().toISOString(),
    };
  }

  if ("cookies" in input && input.cookies !== undefined) {
    const cookies = normalizeCookies(input.cookies);
    const promoted = promoteToken(cookies);
    if (!promoted) {
      throw new Error(
        "Could not find a usable access token in the provided cookies. Include your Kick session cookie (e.g. session_token) or pass accessToken explicitly.",
      );
    }
    return {
      accessToken: promoted,
      cookies,
      savedAt: new Date().toISOString(),
    };
  }

  throw new Error(
    "Login requires credentials: { accessToken, cookies? }, { cookies }, or { bag }",
  );
};
