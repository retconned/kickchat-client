import axios from "axios";

import { type Clip, type ClipFeed } from "../types/clips";
import { BROWSER_HEADERS, fetchJson, KICK_API_BASE } from "./kick-api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export const getClips = (cursor?: string): Promise<ClipFeed> =>
  fetchJson<ClipFeed>(
    `${KICK_API_BASE}/api/v2/clips`,
    "clips",
    (value): value is ClipFeed => isRecord(value) && Array.isArray(value.clips),
    cursor ? { cursor } : undefined,
  );

export const getChannelClips = (
  channel: string,
  cursor?: string,
): Promise<ClipFeed> =>
  fetchJson<ClipFeed>(
    `${KICK_API_BASE}/api/v2/channels/${encodeURIComponent(channel)}/clips`,
    "channel clips",
    (value): value is ClipFeed => isRecord(value) && Array.isArray(value.clips),
    cursor ? { cursor } : undefined,
  );

export const getClip = async (clipId: string | number): Promise<Clip> => {
  const data = await fetchJson<{ clip: Clip }>(
    `${KICK_API_BASE}/api/v2/clips/${clipId}`,
    "clip",
    (value): value is { clip: Clip } =>
      isRecord(value) && typeof value.clip === "object" && value.clip !== null,
  );

  return data.clip;
};

export const downloadClip = async (
  clipId: string | number,
): Promise<Buffer> => {
  const clip = await getClip(clipId);

  try {
    const response = await axios.get<ArrayBuffer>(clip.video_url, {
      headers: BROWSER_HEADERS,
      timeout: DOWNLOAD_TIMEOUT_MS,
      responseType: "arraybuffer",
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(
      `Failed to download clip ${clipId}: ${
        axios.isAxiosError(error) ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
};
