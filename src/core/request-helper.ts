import axios, { AxiosHeaders, type AxiosResponse } from "axios";

import { type KickSession, toCookieHeader, xsrfFromJar } from "../auth/session";

export interface RequestConfig {
  session: KickSession;
  channelSlug: string;
}

export interface RequestContext {
  headers: AxiosHeaders;
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 15000;

const BROWSER_FINGERPRINT_HEADERS: Record<string, string> = {
  "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
  "sec-ch-ua-arch": '"arm"',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-full-version": '"132.0.6834.111"',
  "sec-ch-ua-full-version-list":
    '"Not A(Brand";v="8.0.0.0", "Chromium";v="132.0.6834.111"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-model": '""',
  "sec-ch-ua-platform": '"macOS"',
  "sec-ch-ua-platform-version": '"15.0.1"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

export const createHeaders = ({
  session,
  channelSlug,
}: RequestConfig): AxiosHeaders => {
  const headers = new AxiosHeaders();

  headers.set("accept", "application/json");
  headers.set("accept-language", "en-US,en;q=0.9");
  headers.set("authorization", `Bearer ${session.accessToken}`);
  headers.set("cache-control", "max-age=0");
  headers.set("content-type", "application/json");
  headers.set("priority", "u=1, i");
  for (const [name, value] of Object.entries(BROWSER_FINGERPRINT_HEADERS)) {
    headers.set(name, value);
  }
  headers.set("x-app-platform", "web");
  headers.set("cookie", toCookieHeader(session.cookies));
  const xsrfToken = xsrfFromJar(session.cookies);
  if (xsrfToken) {
    headers.set("x-xsrf-token", xsrfToken);
  }
  headers.set("Referer", `https://kick.com/${channelSlug}`);

  return headers;
};

export const createRequestContext = (
  config: RequestConfig,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): RequestContext => ({
  headers: createHeaders(config),
  timeoutMs: timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
});

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(
    status: number,
    statusText: string,
    options?: { cause?: unknown },
  ) {
    super(`Request failed with status: ${status} ${statusText}`.trimEnd(), {
      cause: options?.cause,
    });
    this.name = "HttpStatusError";
    this.status = status;
  }
}

export const isAuthExpiredError = (error: unknown): error is HttpStatusError =>
  error instanceof HttpStatusError && error.status === 401;

export const makeRequest = async <T>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  context: RequestContext,
  data?: unknown,
): Promise<T> => {
  const response: AxiosResponse<T> = await axios({
    method,
    url,
    headers: context.headers,
    timeout: context.timeoutMs,
    data,
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new HttpStatusError(response.status, response.statusText);
  }

  return response.data;
};
