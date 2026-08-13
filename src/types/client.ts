import { type Channel, type Livestream } from "./video";

export type EventHandler<T> = (data: T) => void;

export interface ClientOptions {
  plainEmote?: boolean;
  logger?: boolean;
  readOnly?: boolean;
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

export interface KickClient {
  destroy: () => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  vod: (video_id: string) => Promise<Video>;
  login: (credentials: LoginOptions) => Promise<boolean>;
  user: {
    id: number;
    username: string;
    tag: string;
  } | null;
  sendMessage: (messageContent: string) => Promise<void>;
  banUser: (
    targetUser: string,
    durationInMinutes?: number,
    permanent?: boolean,
  ) => Promise<void>;
  unbanUser: (targetUser: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  slowMode: (mode: "on" | "off", durationInSeconds?: number) => Promise<void>;
  getPoll: (targetChannel?: string) => Promise<Poll | null>;
  getLeaderboards: (targetChannel?: string) => Promise<Leaderboard | null>;
}

export interface AuthenticationSettings {
  username: string;
  password: string;
  otp_secret?: string;
}

type LoginCredentials = {
  username: string;
  password: string;
  otp_secret?: string;
};

type TokenCredentials = {
  bearerToken: string;
  xsrfToken: string;
  cookies: string;
};
export type LoginOptions =
  | { type: "login"; credentials: LoginCredentials }
  | { type: "tokens"; credentials: TokenCredentials };

export type Poll = {
  status: {
    code: number;
    message: string;
    error: boolean;
  };
  data: {
    title: string;
    duration: number;
    result_display_duration: number;
    created_at: string;
    options: {
      id: number;
      label: string;
      votes: number;
    }[];
    remaining: number;
    has_voted: boolean;
    voted_option_id: number | null;
  };
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
