import { describe, expect, it, vi } from "vitest";

import { type MessageData } from "../types/events";
import { parseMessage } from "./message-handling";

const frame = (event: string, data: unknown): string =>
  JSON.stringify({
    event,
    data: typeof data === "string" ? data : JSON.stringify(data),
    channel: "chatrooms.1.v2",
  });

describe("parseMessage", () => {
  it("parses a ChatMessageEvent into typed data", () => {
    const payload = {
      id: "msg-1",
      chatroom_id: 42,
      content: "hello",
      type: "message",
      created_at: "2026-01-01T00:00:00Z",
      sender: { id: 7, username: "alice", slug: "alice" },
    };

    const parsed = parseMessage(
      frame("App\\Events\\ChatMessageEvent", payload),
    );

    expect(parsed).toEqual({ type: "ChatMessage", data: payload });

    if (parsed?.type !== "ChatMessage") {
      throw new Error("expected a ChatMessage");
    }
    const senderUsername: string = (parsed.data as MessageData).sender.username;
    expect(senderUsername).toBe("alice");
  });

  it.each([
    ["SubscriptionEvent", "Subscription"],
    ["GiftedSubscriptionsEvent", "GiftedSubscriptions"],
    ["StreamHostEvent", "StreamHost"],
    ["MessageDeletedEvent", "MessageDeleted"],
    ["UserBannedEvent", "UserBanned"],
    ["UserUnbannedEvent", "UserUnbanned"],
    ["PinnedMessageCreatedEvent", "PinnedMessageCreated"],
    ["PinnedMessageDeletedEvent", "PinnedMessageDeleted"],
    ["PollUpdateEvent", "PollUpdate"],
    ["PollDeleteEvent", "PollDelete"],
    ["FollowersUpdated", "FollowersUpdated"],
    ["StreamerIsLive", "StreamerIsLive"],
    ["StopStreamBroadcast", "StopStreamBroadcast"],
    ["GiftsLeaderboardUpdated", "GiftsLeaderboardUpdated"],
  ])("maps App\\Events\\%s to %s", (kickEvent, expectedType) => {
    const parsed = parseMessage(frame(`App\\Events\\${kickEvent}`, {}));
    expect(parsed?.type).toBe(expectedType);
  });

  it.each([
    ["KicksGifted", "KicksGifted"],
    ["RewardRedeemedEvent", "RewardRedeemed"],
  ])("maps the unprefixed event %s to %s", (kickEvent, expectedType) => {
    const parsed = parseMessage(frame(kickEvent, {}));
    expect(parsed?.type).toBe(expectedType);
  });

  it("parses a FollowersUpdated payload", () => {
    const payload = {
      followers_count: 1200,
      channel_id: 42,
      username: "alice",
      followed: true,
      created_at: 1735689600,
    };

    const parsed = parseMessage(
      frame("App\\Events\\FollowersUpdated", payload),
    );

    expect(parsed).toEqual({ type: "FollowersUpdated", data: payload });
  });

  it("parses a RewardRedeemed payload", () => {
    const payload = {
      reward_title: "Hydrate reminder",
      user_id: 7,
      channel_id: 42,
      username: "alice",
      user_input: null,
      reward_background_color: "#4d55cc",
    };

    const parsed = parseMessage(frame("RewardRedeemedEvent", payload));

    expect(parsed).toEqual({ type: "RewardRedeemed", data: payload });
  });

  it("returns null for Pusher control frames", () => {
    expect(parseMessage(frame("pusher:ping", {}))).toBeNull();
    expect(
      parseMessage(frame("pusher_internal:subscription_succeeded", {})),
    ).toBeNull();
  });

  it("returns null for unknown App events", () => {
    expect(
      parseMessage(frame("App\\Events\\SomethingNewEvent", {})),
    ).toBeNull();
  });

  it("returns null for malformed outer JSON", () => {
    expect(parseMessage("{not json")).toBeNull();
    expect(parseMessage("")).toBeNull();
  });

  it("returns null when the outer frame is not an object", () => {
    expect(parseMessage("[1,2,3]")).toBeNull();
    expect(parseMessage('"just a string"')).toBeNull();
  });

  it("returns null when the inner payload is not valid JSON", () => {
    const raw = JSON.stringify({
      event: "App\\Events\\ChatMessageEvent",
      data: "{broken",
      channel: "chatrooms.1.v2",
    }) as string;
    expect(parseMessage(raw)).toBeNull();
  });

  it("returns null when the data field is missing or not a string", () => {
    const missing = JSON.stringify({
      event: "App\\Events\\ChatMessageEvent",
      channel: "c",
    });
    const wrongType = JSON.stringify({
      event: "App\\Events\\ChatMessageEvent",
      data: { id: "not-a-string-payload" },
      channel: "c",
    });

    expect(parseMessage(missing)).toBeNull();
    expect(parseMessage(wrongType)).toBeNull();
  });

  it("never logs — control traffic must stay silent", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      parseMessage(frame("pusher:pong", {}));
      parseMessage("garbage");
      parseMessage(frame("App\\Events\\UnknownEvent", {}));

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
