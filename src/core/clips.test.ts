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

import { downloadClip, getChannelClips, getClip, getClips } from "./clips";

const clip = {
  id: "clip-1",
  is_mature: false,
  title: "Funny moment",
  duration: 30,
  thumbnail_url: "https://files.kick.com/thumb.jpg",
  video_url: "https://files.kick.com/video.mp4",
  view_count: 100,
  likes_count: 5,
  liked: false,
  created_at: "2026-01-01T00:00:00Z",
  creator: null,
  channel: null,
  category: null,
};

describe("getClips", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("fetches the global clips feed", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { clips: [clip] } });

    const result = await getClips();

    expect(result.clips).toEqual([clip]);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/clips",
      expect.anything(),
    );
  });

  it("appends the cursor when provided", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { clips: [] } });

    await getClips("abc");

    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/clips?cursor=abc",
      expect.anything(),
    );
  });

  it("rejects payloads without a clips array", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: {} });

    await expect(getClips()).rejects.toThrow("Unexpected clips response shape");
  });
});

describe("getChannelClips", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("fetches clips for a channel with a cursor", async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      data: { clips: [clip], next_cursor: "next" },
    });

    const result = await getChannelClips("xqc", "cur-1");

    expect(result.next_cursor).toBe("next");
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/channels/xqc/clips?cursor=cur-1",
      expect.anything(),
    );
  });
});

describe("getClip", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("unwraps the clip object from the response", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { clip } });

    const result = await getClip("clip-1");

    expect(result).toEqual(clip);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/clips/clip-1",
      expect.anything(),
    );
  });

  it("rejects responses without a clip object", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { nope: true } });

    await expect(getClip(7)).rejects.toThrow("Unexpected clip response shape");
  });
});

describe("downloadClip", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("downloads the binary video for the resolved clip", async () => {
    const payload = new Uint8Array([1, 2, 3]).buffer;
    axiosGet
      .mockResolvedValueOnce({ status: 200, data: { clip } })
      .mockResolvedValueOnce({ status: 200, data: payload });

    const result = await downloadClip("clip-1");

    expect([...result]).toEqual([1, 2, 3]);
    expect(axiosGet).toHaveBeenLastCalledWith(
      "https://files.kick.com/video.mp4",
      expect.objectContaining({ responseType: "arraybuffer" }),
    );
  });

  it("wraps download failures with the clip id", async () => {
    axiosGet
      .mockResolvedValueOnce({ status: 200, data: { clip } })
      .mockRejectedValueOnce(new Error("boom"));

    await expect(downloadClip("clip-1")).rejects.toThrow(
      /Failed to download clip clip-1: .*boom/,
    );
  });
});
