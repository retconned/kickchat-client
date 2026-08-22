import {
  type ChatMessage,
  type GiftedSubscriptionsEvent,
  type MessageDeletedEvent,
  type MessageEvent,
  type PinnedMessageCreatedEvent,
  type PollDeleteEvent,
  type PollUpdateEvent,
  type StreamHostEvent,
  type Subscription,
  type UserBannedEvent,
  type UserUnbannedEvent,
} from "../types/events";

/** Links each surfaced event type to its payload type; the source of truth
 * for both {@link ParsedMessage} and the runtime parser below. */
interface MessageDataByType {
  ChatMessage: ChatMessage;
  Subscription: Subscription;
  GiftedSubscriptions: GiftedSubscriptionsEvent;
  StreamHost: StreamHostEvent;
  MessageDeleted: MessageDeletedEvent;
  UserBanned: UserBannedEvent;
  UserUnbanned: UserUnbannedEvent;
  PinnedMessageCreated: PinnedMessageCreatedEvent;
  PinnedMessageDeleted: MessageDeletedEvent;
  PollUpdate: PollUpdateEvent;
  PollDelete: PollDeleteEvent;
}

export type ParsedMessage = {
  [K in keyof MessageDataByType]: { type: K; data: MessageDataByType[K] };
}[keyof MessageDataByType];

const parseJSON = <T>(json: string): T | null => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

/**
 * Kick Pusher events we surface to consumers, mapped by their fully
 * qualified `App\Events\…` name. Unknown events (including all Pusher
 * control traffic) are intentionally ignored — they are routine, not
 * errors worth logging. The table guarantees the event name ↔ message
 * type correlation that the final cast in {@link parseMessage} relies on.
 */
const EVENT_NAME_TO_TYPE: Record<string, keyof MessageDataByType> = {
  "App\\Events\\ChatMessageEvent": "ChatMessage",
  "App\\Events\\SubscriptionEvent": "Subscription",
  "App\\Events\\GiftedSubscriptionsEvent": "GiftedSubscriptions",
  "App\\Events\\StreamHostEvent": "StreamHost",
  "App\\Events\\MessageDeletedEvent": "MessageDeleted",
  "App\\Events\\UserBannedEvent": "UserBanned",
  "App\\Events\\UserUnbannedEvent": "UserUnbanned",
  "App\\Events\\PinnedMessageCreatedEvent": "PinnedMessageCreated",
  "App\\Events\\PinnedMessageDeletedEvent": "PinnedMessageDeleted",
  "App\\Events\\PollUpdateEvent": "PollUpdate",
  "App\\Events\\PollDeleteEvent": "PollDelete",
};

/** Parses one raw Pusher frame into a typed message, or `null` for frames
 * this library does not surface (control frames, unknown/invalid events). */
export const parseMessage = (message: string): ParsedMessage | null => {
  const event = parseJSON<MessageEvent>(message);

  if (
    !event ||
    typeof event.event !== "string" ||
    typeof event.data !== "string"
  ) {
    return null;
  }

  const type = EVENT_NAME_TO_TYPE[event.event];
  if (!type) {
    return null;
  }

  const data: MessageDataByType[typeof type] | null = parseJSON(event.data);

  // Safe: EVENT_NAME_TO_TYPE ties `type` to the payload type we parsed.
  return data ? ({ type, data } as unknown as ParsedMessage) : null;
};
