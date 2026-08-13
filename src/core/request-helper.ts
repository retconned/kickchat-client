import axios, { AxiosHeaders, type AxiosResponse } from "axios";

import { decodeXsrfToken } from "../utils/utils";

export interface RequestConfig {
  bearerToken: string;
  xsrfToken: string;
  cookies: string;
  channelSlug: string;
}

export const createHeaders = ({
  bearerToken,
  xsrfToken,
  cookies,
  channelSlug,
}: RequestConfig): AxiosHeaders => {
  const headers = new AxiosHeaders();

  headers.set("accept", "application/json");
  headers.set("accept-language", "en-US,en;q=0.9");
  headers.set("authorization", `Bearer ${bearerToken}`);
  headers.set("cache-control", "max-age=0");
  headers.set("cluster", "v2");
  headers.set("content-type", "application/json");
  headers.set("priority", "u=1, i");
  headers.set("cookie", cookies);
  headers.set("x-xsrf-token", decodeXsrfToken(xsrfToken));
  headers.set("Referer", `https://kick.com/${channelSlug}`);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return headers;
};

export const makeRequest = async <T>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  headers: AxiosHeaders,
  data?: unknown,
): Promise<T> => {
  const response: AxiosResponse<T> = await axios({
    method,
    url,
    headers,
    data,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed with status: ${response.status}`);
  }

  return response.data;
};
