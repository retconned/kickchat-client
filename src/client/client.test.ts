import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ReconnectingSocketOptions } from "../core/websocket";

type MockResponse = { status: number; statusText?: string; data: unknown };

const axiosCall = vi.hoisted(() =>
  vi.fn<(args: unknown[]) => Promise<MockResponse>>(async () => ({
    status: 200,
    data: { success: true },
  })),
);

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(axiosCall, actual.default, {
      // fetchJson-style helpers go through axios.get(url, config).
      get: axiosCall,
    }),
  };
});

const getVideoData = vi.hoisted(() => vi.fn());

vi.mock("../core/kick-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/kick-api")>();
  return {
    ...actual,
    getChannelData: vi.fn(async () => ({
      id: 1,
      slug: "xqc",
      user: { username: "xqc" },
      chatroom: { id: 51082 },
    })),
    getVideoData,
  };
});

const wsFactory = vi.hoisted(() =>
  vi.fn((_chatroomId: number, _options?: ReconnectingSocketOptions) => ({
    close: vi.fn(),
  })),
);

vi.mock("../core/websocket", () => ({
  createReconnectingWebSocket: wsFactory,
}));

import { createClient } from "./client";

const credentials = { accessToken: "tok", cookies: "XSRF-TOKEN=a%2Fb" };

describe("createClient validation", () => {
  it("rejects empty and whitespace-only channel names", () => {
    expect(() => createClient("")).toThrow(/non-empty channel name/);
    expect(() => createClient("   ")).toThrow(/non-empty channel name/);
    expect(() => createClient("bad/name")).toThrow(
      /may only contain letters, digits and underscores/,
    );
  });
});

describe("client lifecycle guards", () => {
  beforeEach(() => {
    axiosCall.mockClear();
    axiosCall.mockResolvedValue({ status: 200, data: { success: true } });
  });

  it("starts unauthenticated with no user", () => {
    const client = createClient("xqc");
    expect(client.isAuthenticated).toBe(false);
    expect(client.user).toBeNull();
  });
  it("refuses authenticated actions before login", async () => {
    const client = createClient("xqc");

    await expect(client.sendMessage("hi")).rejects.toThrow(
      /Authentication required/,
    );
    expect(client.isAuthenticated).toBe(false);
  });

  it("rejects empty messages without touching the network", async () => {
    const client = createClient("xqc");
    await client.login(credentials);

    await expect(client.sendMessage("   ")).rejects.toThrow(/cannot be empty/);
    expect(axiosCall).not.toHaveBeenCalled();
  });

  it("logs in, sends, and reports the session state", async () => {
    const client = createClient("xqc");
    await client.login(credentials);

    expect(client.isAuthenticated).toBe(true);
    expect(client.user).toMatchObject({ username: "xqc" });

    await client.sendMessage("hello");
    expect(axiosCall).toHaveBeenCalledTimes(1);
    const sent = axiosCall.mock.calls[0]?.[0] as unknown as {
      method: string;
      url: string;
      data: { content: string; type: string; message_ref: string };
    };
    expect(sent).toMatchObject({
      method: "post",
      url: "https://kick.com/api/v2/messages/send/51082",
    });
    expect(sent.data).toMatchObject({ content: "hello", type: "message" });
    expect(sent.data.message_ref).toMatch(/^\d+$/);
  });

  it("logs in and sends without any XSRF cookie (header omitted)", async () => {
    const client = createClient("xqc");
    await client.login({ accessToken: "tok", cookies: "session_token=abc" });
    expect(client.isAuthenticated).toBe(true);

    await client.sendMessage("hi");

    const send = axiosCall.mock.calls[0]?.[0] as unknown as {
      url: string;
      headers: { get: (name: string) => string | undefined };
    };
    expect(send.url).toBe("https://kick.com/api/v2/messages/send/51082");
    expect(send.headers.get("x-xsrf-token")).toBeUndefined();
    expect(send.headers.get("cookie")).toBe("session_token=abc");
  });

  it("emits authExpired on 401 and wraps the failure", async () => {
    const client = createClient("xqc");
    const onAuthExpired = vi.fn();
    client.on("authExpired", onAuthExpired);

    await client.login(credentials);

    axiosCall.mockResolvedValueOnce({ status: 401, data: "" });
    await expect(client.sendMessage("hi")).rejects.toThrow(
      "Failed to send message",
    );
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous session when a re-login fails", async () => {
    const client = createClient("xqc");
    await client.login(credentials);
    expect(client.isAuthenticated).toBe(true);

    await expect(
      client.login({ cookies: "session_token=short; XSRF-TOKEN=x" }),
    ).rejects.toThrow();

    expect(client.isAuthenticated).toBe(true);
  });

  it("read-only mode refuses login entirely", async () => {
    const client = createClient("xqc", { readOnly: true });

    await expect(client.login(credentials)).rejects.toThrow(
      /Read-only mode does not support authentication/,
    );
    expect(client.isAuthenticated).toBe(false);

    client.destroy();
  });

  it("blocks login after destroy", async () => {
    const client = createClient("xqc");
    client.destroy();

    await expect(client.login(credentials)).rejects.toThrow(
      "Client has been destroyed",
    );
  });
});

describe("authenticated actions", () => {
  beforeEach(() => {
    axiosCall.mockClear();
    axiosCall.mockResolvedValue({ status: 200, data: { success: true } });
  });

  const loggedIn = async () => {
    const client = createClient("xqc");
    await client.login(credentials);
    return client;
  };

  it("sends bans with the permanent flag", async () => {
    const client = await loggedIn();

    await client.banUser("spammer", undefined, true);

    expect(axiosCall.mock.calls[0]?.[0]).toMatchObject({
      method: "post",
      url: "https://kick.com/api/v2/channels/1/bans",
      data: { banned_username: "spammer", permanent: true },
    });
  });

  it("validates ban arguments before calling the API", async () => {
    const client = await loggedIn();

    await expect(client.banUser("", 5)).rejects.toThrow(/Specify a user/);
    await expect(client.banUser("x")).rejects.toThrow(/duration in minutes/);
    await expect(client.banUser("x", -1)).rejects.toThrow(
      /more than 0 minutes/,
    );
    expect(axiosCall).not.toHaveBeenCalled();
  });

  it("rejects identifiers that would corrupt the request path", async () => {
    const client = await loggedIn();

    await expect(client.banUser("../admin")).rejects.toThrow(
      /may only contain letters, digits and underscores/,
    );
    await expect(client.unbanUser("foo bar")).rejects.toThrow(
      /may only contain letters, digits and underscores/,
    );
    await expect(client.deleteMessage("a?b")).rejects.toThrow(/messageId/);
    await expect(client.getPoll("bad/channel")).rejects.toThrow(
      /may only contain letters, digits and underscores/,
    );
    await expect(client.getLeaderboards("x#y")).rejects.toThrow(
      /may only contain letters, digits and underscores/,
    );
    expect(axiosCall).not.toHaveBeenCalled();
    client.destroy();
  });

  it("emits ready once and reconnected on subsequent connections", async () => {
    const client = createClient("xqc");
    const onReady = vi.fn();
    const onReconnected = vi.fn();
    client.on("ready", onReady);
    client.on("reconnected", onReconnected);

    await client.login(credentials);

    // The socket created by this login; simulate two connections on it.
    const [, options] = wsFactory.mock.lastCall ?? [];
    options?.onOpen?.(); // first connection → ready
    options?.onClose?.();
    options?.onOpen?.(); // subsequent connection → reconnected

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(onReconnected).toHaveBeenCalledWith(expect.anything());
    client.destroy();
  });

  it("unbans users and deletes messages via DELETE", async () => {
    const client = await loggedIn();

    await client.unbanUser("spammer");
    expect(axiosCall.mock.calls[0]?.[0]).toMatchObject({
      method: "delete",
      url: "https://kick.com/api/v2/channels/1/bans/spammer",
    });

    await client.deleteMessage("msg-9");
    expect(axiosCall.mock.calls[1]?.[0]).toMatchObject({
      method: "delete",
      url: "https://kick.com/api/v2/channels/1/messages/msg-9",
    });
  });

  it("toggles slow mode with and without intervals", async () => {
    const client = await loggedIn();

    await client.slowMode("on", 30);
    expect(axiosCall.mock.calls[0]?.[0]).toMatchObject({
      method: "put",
      data: { slow_mode: true, message_interval: 30 },
    });

    await client.slowMode("off");
    expect(axiosCall.mock.calls[1]?.[0]).toMatchObject({
      method: "put",
      data: { slow_mode: false },
    });

    await expect(client.slowMode("on")).rejects.toThrow(/Invalid duration/);
  });

  it("fetches polls and leaderboards, defaulting to the joined channel", async () => {
    const client = await loggedIn();

    axiosCall.mockResolvedValueOnce({ status: 200, data: { poll: true } });
    const poll = await client.getPoll();
    expect(poll).toEqual({ poll: true });
    expect(axiosCall.mock.calls[0]?.[0]).toMatchObject({
      method: "get",
      url: "https://kick.com/api/v2/channels/xqc/polls",
    });

    axiosCall.mockResolvedValueOnce({ status: 200, data: { gifts: [] } });
    const boards = await client.getLeaderboards("otherchannel");
    expect(boards).toEqual({ gifts: [] });
    expect(axiosCall.mock.calls[1]?.[0]).toMatchObject({
      method: "get",
      url: "https://kick.com/api/v2/channels/otherchannel/leaderboards",
    });
  });

  it("maps VOD payloads into the public shape", async () => {
    getVideoData.mockClear();
    getVideoData.mockResolvedValue({
      id: 9,
      uuid: "u-1",
      created_at: "c",
      updated_at: "u",
      views: 10,
      source: "src",
      live_stream_id: 3,
      livestream: {
        session_title: "title",
        thumbnail: "thumb",
        duration: 60,
        start_time: "start",
        language: "en",
        channel: {},
      },
    });

    const client = await loggedIn();
    const vod = await client.vod("u-1");

    expect(vod).toMatchObject({ id: 9, title: "title", views: 10 });
    expect(getVideoData).toHaveBeenCalledWith("u-1");
  });

  it("rejects VODs without livestream data", async () => {
    getVideoData.mockClear();
    getVideoData.mockResolvedValue({ id: 9, uuid: "u-1" });

    const client = await loggedIn();
    await expect(client.vod("u-1")).rejects.toThrow(
      /Unable to fetch livestream data/,
    );
  });

  it("fetches followers count, rules, links, videos, and clips", async () => {
    const client = await loggedIn();

    axiosCall.mockResolvedValueOnce({
      status: 200,
      data: { data: { count: 99 } },
    });
    expect(await client.getFollowers()).toBe(99);
    expect(axiosCall.mock.calls[0]?.[0]).toBe(
      "https://kick.com/api/v1/channels/xqc/followers-count",
    );

    axiosCall.mockResolvedValueOnce({
      status: 200,
      data: { data: { rules: "Be kind" } },
    });
    expect(await client.getRules()).toBe("Be kind");

    axiosCall.mockResolvedValueOnce({ status: 200, data: [{ id: 3 }] });
    expect(await client.getLinks()).toEqual([{ id: 3 }]);

    axiosCall.mockResolvedValueOnce({ status: 200, data: [{ id: 8 }] });
    expect(await client.getVideos("xqc")).toEqual([{ id: 8 }]);
    expect(axiosCall.mock.calls[3]?.[0]).toBe(
      "https://kick.com/api/v2/channels/xqc/videos",
    );

    const clip = { id: "c1" };
    axiosCall.mockResolvedValueOnce({
      status: 200,
      data: { clips: [clip], next_cursor: "n1" },
    });
    const feed = await client.getClips();
    expect(feed.clips).toEqual([clip]);
    expect(feed.next_cursor).toBe("n1");
    expect(axiosCall.mock.calls[4]?.[0]).toBe(
      "https://kick.com/api/v2/channels/xqc/clips",
    );
  });
});

describe("listener management", () => {
  const loggedIn = async () => {
    const client = createClient("xqc");
    await client.login(credentials);
    return client;
  };

  it("on() returns an unsubscribe function", async () => {
    const client = await loggedIn();
    const [, handleOptions] = wsFactory.mock.lastCall ?? [];

    const listener = vi.fn();
    const off = client.on("disconnect", listener);

    handleOptions?.onClose?.();
    expect(listener).toHaveBeenCalledTimes(1);

    off();
    handleOptions?.onClose?.();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("once() fires at most once and unsubscribes cleanly", async () => {
    const client = await loggedIn();
    const [, handleOptions] = wsFactory.mock.lastCall ?? [];

    const listener = vi.fn();
    client.once("disconnect", listener);

    handleOptions?.onClose?.();
    handleOptions?.onClose?.();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
