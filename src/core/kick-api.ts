import axios from "axios";
import { type KickChannelInfo } from "../types/channels";
import { type VideoInfo } from "../types/video";
import { DEFAULT_TIMEOUT_MS } from "./request-helper";

export const KICK_API_BASE = "https://kick.com";

const BROWSER_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "max-age=0",
  referer: "https://kick.com/",
  "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
};

const CLOUDFLARE_MESSAGE =
  "Request blocked by Cloudflare protection. Please try again later.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fetchJson = async <T>(
  url: string,
  label: string,
  isValidShape?: (data: Record<string, unknown>) => boolean,
): Promise<T> => {
  let status = 0;
  let data: unknown;

  try {
    const response = await axios.get<unknown>(url, {
      headers: BROWSER_HEADERS,
      timeout: DEFAULT_TIMEOUT_MS,
      validateStatus: () => true,
    });
    status = response.status;
    data = response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch ${label}: ${
        axios.isAxiosError(error) ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (status === 403) {
    throw new Error(CLOUDFLARE_MESSAGE);
  }

  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch ${label}: received status ${status}`);
  }

  if (!isRecord(data) || (isValidShape !== undefined && !isValidShape(data))) {
    throw new Error(
      `Unexpected ${label} response shape${status === 200 ? "; Kick may have served a challenge page" : ""}`,
    );
  }

  return data as T;
};

export const getChannelData = async (
  channel: string,
): Promise<KickChannelInfo> =>
  fetchJson<KickChannelInfo>(
    `${KICK_API_BASE}/api/v2/channels/${channel}`,
    "channel data",
    (data) => isRecord(data.chatroom) && typeof data.chatroom.id === "number",
  );

export const getVideoData = async (videoId: string): Promise<VideoInfo> =>
  fetchJson<VideoInfo>(
    `${KICK_API_BASE}/api/v1/video/${videoId}`,
    "video data",
    (data) => "id" in data || "uuid" in data,
  );
