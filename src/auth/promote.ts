import { type KickSession } from "./session";

export const TOKEN_NAMES = [
  "session_token",
  "kick_session",
  "laravel_session",
  "auth_token",
  "access_token",
  "token",
] as const;

export const LS_PREFIX = "__ls_";
export const SS_PREFIX = "__ss_";

export type Bag = Record<string, string>;

export const isJwtLike = (value: string): boolean =>
  value.length > 50 && value.startsWith("eyJ");

const prefixedName = (prefix: string, name: string): string =>
  `${prefix}${name}`;

export const promoteToken = (
  bag: Bag,
  names: readonly string[] = TOKEN_NAMES,
): string | null => {
  for (const name of names) {
    const value = bag[name];
    if (value && value.length > 20) {
      return value;
    }
  }

  for (const prefix of [LS_PREFIX, SS_PREFIX]) {
    for (const name of names) {
      const value = bag[prefixedName(prefix, name)];
      if (value && value.length > 20) {
        return value;
      }
    }
  }

  for (const value of Object.values(bag)) {
    if (isJwtLike(value)) {
      return value;
    }
  }

  for (const [key, value] of Object.entries(bag)) {
    const lower = key.toLowerCase();
    if (
      value.length > 40 &&
      !lower.includes("xsrf") &&
      !lower.includes("csrf")
    ) {
      return value;
    }
  }

  return null;
};

export const bagCookies = (bag: Bag): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const [key, value] of Object.entries(bag)) {
    if (!key.startsWith(LS_PREFIX) && !key.startsWith(SS_PREFIX)) {
      cookies[key] = value;
    }
  }
  return cookies;
};

export const promoteSession = (bag: Bag): KickSession | null => {
  const accessToken = promoteToken(bag);
  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    cookies: bagCookies(bag),
    savedAt: new Date().toISOString(),
  };
};
