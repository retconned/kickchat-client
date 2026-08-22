import { type CookieInput } from "../auth/session";
import {
  type GiftedSubscriptionsEvent,
  type MessageData,
  type MessageDeletedEvent,
  type PinnedMessageCreatedEvent,
  type PollDeleteEvent,
  type PollUpdateEvent,
  type StreamHostEvent,
  type Subscription,
  type UserBannedEvent,
  type UserUnbannedEvent,
} from "./events";
import { type Channel, type Livestream } from "./video";

export interface ClientOptions {
  plainEmote?: boolean;
  logger?: boolean;
  readOnly?: boolean;
  timeoutMs?: number;
}

export interface Video {
  id: number;
  title: string;
  thumbnail: string;
  duration: number;
  live_stream_id: number;
  start_time: string;
  created_at: string;
  updated_at: string;
  uuid: string;
  views: number;
  stream: string;
  language: string;
  livestream: Livestream;
  channel: Channel;
}

export interface KickClientUser {
  id: number;
  username: string;
  tag: string;
}

export interface ClientEvents {
  ready: (user: KickClientUser) => void;
  ChatMessage: (data: MessageData) => void;
  Subscription: (data: Subscription) => void;
  GiftedSubscriptions: (data: GiftedSubscriptionsEvent) => void;
  StreamHost: (data: StreamHostEvent) => void;
  MessageDeleted: (data: MessageDeletedEvent) => void;
  UserBanned: (data: UserBannedEvent) => void;
  UserUnbanned: (data: UserUnbannedEvent) => void;
  PinnedMessageCreated: (data: PinnedMessageCreatedEvent) => void;
  PinnedMessageDeleted: (data: MessageDeletedEvent) => void;
  PollUpdate: (data: PollUpdateEvent) => void;
  PollDelete: (data: PollDeleteEvent) => void;
  authExpired: () => void;
  disconnect: () => void;
  error: (error: unknown) => void;
}

export interface KickClient {
  destroy: () => void;
  on: <K extends keyof ClientEvents>(
    event: K,
    listener: ClientEvents[K],
  ) => () => void;
  once: <K extends keyof ClientEvents>(
    event: K,
    listener: ClientEvents[K],
  ) => () => void;
  vod: (video_id: string) => Promise<Video>;
  login: (credentials: LoginOptions) => Promise<void>;
  user: KickClientUser | null;
  isAuthenticated: boolean;
  sendMessage: (messageContent: string) => Promise<void>;
  banUser: (
    targetUser: string,
    durationInMinutes?: number,
    permanent?: boolean,
  ) => Promise<void>;
  unbanUser: (targetUser: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  slowMode: (mode: "on" | "off", durationInSeconds?: number) => Promise<void>;
  getPoll: (targetChannel?: string) => Promise<Poll>;
  getLeaderboards: (targetChannel?: string) => Promise<Leaderboard>;
}

export type LoginOptions =
  | { accessToken: string; cookies?: CookieInput }
  | { cookies: CookieInput }
  | { bag: Record<string, string> };

export interface PollData {
  title: string;
  duration: number;
  result_display_duration: number;
  created_at: string;
  options: { id: number; label: string; votes: number }[];
  remaining: number;
  has_voted: boolean;
  voted_option_id: number | null;
}

export type Poll = {
  status: {
    code: number;
    message: string;
    error: boolean;
  };
  data: PollData | null;
};

export type Leaderboard = {
  gifts: Gift[];
  gifts_enabled: boolean;
  gifts_week: Gift[];
  gifts_week_enabled: boolean;
  gifts_month: Gift[];
  gifts_month_enabled: boolean;
};

export type Gift = {
  user_id: number;
  username: string;
  quantity: number;
};
