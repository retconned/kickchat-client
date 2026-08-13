import { type LoginOptions } from "../types/client";

export const parseJSON = <T>(json: string): T => JSON.parse(json) as T;

export const decodeXsrfToken = (token: string): string => {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

export const validateCredentials = (options: LoginOptions) => {
  const { type, credentials } = options;
  switch (type) {
    case "login":
      if (!credentials.username || typeof credentials.username !== "string") {
        throw new Error("Username is required and must be a string");
      }
      if (!credentials.password || typeof credentials.password !== "string") {
        throw new Error("Password is required and must be a string");
      }
      if (
        credentials.otp_secret !== undefined &&
        typeof credentials.otp_secret !== "string"
      ) {
        throw new Error("OTP secret must be a string if provided");
      }
      break;
    case "tokens":
      if (
        !credentials.bearerToken ||
        typeof credentials.bearerToken !== "string"
      ) {
        throw new Error("bearerToken is required and must be a string");
      }
      if (!credentials.xsrfToken || typeof credentials.xsrfToken !== "string") {
        throw new Error("xsrfToken is required and must be a string");
      }
      if (!credentials.cookies || typeof credentials.cookies !== "string") {
        throw new Error("cookies are required and must be a string");
      }
      break;

    default:
      throw new Error("Invalid login type");
  }
};
