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

import {
  getChannelData,
  getChannelLinks,
  getChannelVideos,
  getChatroomRules,
  getFollowersCount,
  getVideoData,
} from "./kick-api";

describe("getChannelData", () => {
  beforeEach(() => {
    axiosGet.mockClear();
    axiosGet.mockResolvedValue({ status: 200, data: {} });
  });

  it("fetches and returns valid channel data", async () => {
    const payload = { id: 1, slug: "xqc", chatroom: { id: 51082 } };
    axiosGet.mockResolvedValue({ status: 200, data: payload });

    const result = await getChannelData("xqc");

    expect(result).toEqual(payload);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/channels/xqc",
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it("throws the Cloudflare message on 403", async () => {
    axiosGet.mockResolvedValue({ status: 403, data: "blocked" });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Request blocked by Cloudflare protection",
    );
  });

  it("includes the status for other non-2xx responses", async () => {
    axiosGet.mockResolvedValue({ status: 500, data: "oops" });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Failed to fetch channel data: received status 500",
    );
  });

  it("rejects HTML bodies served with a 200 (challenge pages)", async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      data: "<html>Just a moment...</html>",
    });

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Unexpected channel data response shape; Kick may have served a challenge page/,
    );
  });

  it("validates that chatroom.id exists for channel payloads", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { id: 1 } });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Unexpected channel data response shape",
    );
  });

  it("wraps network failures with the fetch label", async () => {
    axiosGet.mockRejectedValue(new Error("ECONNRESET"));

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Failed to fetch channel data: .*ECONNRESET/,
    );
  });
});

describe("getVideoData", () => {
  it("accepts payloads identified by uuid alone", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { uuid: "abc-123" } });

    const result = await getVideoData("abc-123");

    expect(result).toEqual({ uuid: "abc-123" });
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/video/abc-123",
      expect.anything(),
    );
  });

  it("rejects unrecognizable video payloads", async () => {
    axiosGet.mockClear();
    axiosGet.mockResolvedValue({ status: 200, data: { unrelated: true } });

    await expect(getVideoData("xyz")).rejects.toThrow(
      "Unexpected video data response shape",
    );
  });
});

describe("getFollowersCount", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("returns the count from the wrapped payload", async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      data: { data: { count: 4213 } },
    });

    const result = await getFollowersCount("xqc");

    expect(result).toBe(4213);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/channels/xqc/followers-count",
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it("rejects payloads without a numeric count", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { data: {} } });

    await expect(getFollowersCount("xqc")).rejects.toThrow(
      "Unexpected followers count response shape",
    );
  });
});

describe("getChatroomRules", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("returns the rules text from the wrapped payload", async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      data: { data: { rules: "Be nice" } },
    });

    const result = await getChatroomRules("xqc");

    expect(result).toBe("Be nice");
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/channels/xqc/chatroom/rules",
      expect.anything(),
    );
  });

  it("rejects non-string rules", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { data: { rules: 7 } } });

    await expect(getChatroomRules("xqc")).rejects.toThrow(
      "Unexpected chatroom rules response shape",
    );
  });
});

describe("getChannelLinks", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("returns the links array", async () => {
    const links = [{ id: 1, link: "https://example.com", order: 0 }];
    axiosGet.mockResolvedValue({ status: 200, data: links });

    const result = await getChannelLinks("xqc");

    expect(result).toEqual(links);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/channels/xqc/links",
      expect.anything(),
    );
  });

  it("rejects object responses (expected an array)", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { links: [] } });

    await expect(getChannelLinks("xqc")).rejects.toThrow(
      "Unexpected channel links response shape",
    );
  });
});

describe("getChannelVideos", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("returns the videos array", async () => {
    const videos = [
      { id: 9, session_title: "VOD", channel_id: 5, video: { uuid: "u" } },
    ];
    axiosGet.mockResolvedValue({ status: 200, data: videos });

    const result = await getChannelVideos("xqc");

    expect(result).toEqual(videos);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v2/channels/xqc/videos",
      expect.anything(),
    );
  });

  it("propagates the Cloudflare message on 403", async () => {
    axiosGet.mockResolvedValue({ status: 403, data: "blocked" });

    await expect(getChannelVideos("xqc")).rejects.toThrow(
      "Request blocked by Cloudflare protection",
    );
  });
});
