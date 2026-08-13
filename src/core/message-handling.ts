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
import { parseJSON } from "../utils/utils";

export type ParsedMessage =
  | { type: "ChatMessage"; data: ChatMessage }
  | { type: "Subscription"; data: Subscription }
  | { type: "GiftedSubscriptions"; data: GiftedSubscriptionsEvent }
  | { type: "StreamHost"; data: StreamHostEvent }
  | { type: "MessageDeleted"; data: MessageDeletedEvent }
  | { type: "UserBanned"; data: UserBannedEvent }
  | { type: "UserUnbanned"; data: UserUnbannedEvent }
  | { type: "PinnedMessageCreated"; data: PinnedMessageCreatedEvent }
  | { type: "PinnedMessageDeleted"; data: MessageDeletedEvent }
  | { type: "PollUpdate"; data: PollUpdateEvent }
  | { type: "PollDelete"; data: PollDeleteEvent };

export const parseMessage = (message: string): ParsedMessage | null => {
  try {
    const messageEventJSON = parseJSON<MessageEvent>(message);

    // switch event type
    switch (messageEventJSON.event) {
      case "App\\Events\\ChatMessageEvent": {
        const data = parseJSON<ChatMessage>(messageEventJSON.data);
        return { type: "ChatMessage", data };
      }
      case "App\\Events\\SubscriptionEvent": {
        const data = parseJSON<Subscription>(messageEventJSON.data);
        return { type: "Subscription", data };
      }
      case "App\\Events\\GiftedSubscriptionsEvent": {
        const data = parseJSON<GiftedSubscriptionsEvent>(messageEventJSON.data);
        return { type: "GiftedSubscriptions", data };
      }
      case "App\\Events\\StreamHostEvent": {
        const data = parseJSON<StreamHostEvent>(messageEventJSON.data);
        return { type: "StreamHost", data };
      }
      case "App\\Events\\MessageDeletedEvent": {
        const data = parseJSON<MessageDeletedEvent>(messageEventJSON.data);
        return { type: "MessageDeleted", data };
      }
      case "App\\Events\\UserBannedEvent": {
        const data = parseJSON<UserBannedEvent>(messageEventJSON.data);
        return { type: "UserBanned", data };
      }
      case "App\\Events\\UserUnbannedEvent": {
        const data = parseJSON<UserUnbannedEvent>(messageEventJSON.data);
        return { type: "UserUnbanned", data };
      }
      case "App\\Events\\PinnedMessageCreatedEvent": {
        const data = parseJSON<PinnedMessageCreatedEvent>(
          messageEventJSON.data,
        );
        return { type: "PinnedMessageCreated", data };
      }
      case "App\\Events\\PinnedMessageDeletedEvent": {
        const data = parseJSON<MessageDeletedEvent>(messageEventJSON.data);
        return { type: "PinnedMessageDeleted", data };
      }
      case "App\\Events\\PollUpdateEvent": {
        const data = parseJSON<PollUpdateEvent>(messageEventJSON.data);
        return { type: "PollUpdate", data };
      }
      case "App\\Events\\PollDeleteEvent": {
        const data = parseJSON<PollDeleteEvent>(messageEventJSON.data);
        return { type: "PollDelete", data };
      }

      default: {
        console.log("Unknown event type:", messageEventJSON.event);
        return null;
      }
    }
  } catch (error) {
    console.error("Error parsing message:", error);
    return null;
  }
};
