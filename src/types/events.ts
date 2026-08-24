export interface MessageEvent {
  event: string;
  data: string;
  channel: string;
}

export interface MessageData {
  id: string;
  chatroom_id: number;
  content: string;
  type: string;
  created_at: string;
  sender: {
    id: number;
    username: string;
    slug: string;
    identity: { color: string; badges: unknown };
  };
  metadata?: {
    original_sender: { id: string; username: string };
    original_message: {
      id: string;
      content: string;
    };
  };
}

export interface SubscriptionData {
  username: string;
  months: number;
}

export interface ChatMessage {
  id: string;
  chatroom_id: number;
  content: string;
  type: string;
  created_at: string;
  sender: {
    id: number;
    username: string;
    slug: string;
    identity: { color: string; badges: unknown };
  };
}

export interface Subscription {
  chatroom_id: number;
  username: string;
  months: number;
}

export interface GiftedSubscriptionsEvent {
  chatroom_id: number;
  gifted_usernames: string[];
  gifter_username: string;
}

export interface StreamHostEvent {
  chatroom_id: number;
  optional_message: string;
  number_viewers: number;
  host_username: string;
}

export interface MessageDeletedEvent {
  id: string;
  message: {
    id: string;
  };
}

export interface UserBannedEvent {
  id: string;
  user: {
    id: number;
    username: string;
    slug: string;
  };

  banned_by: {
    id: number;
    username: string;
    slug: string;
  };

  expires_at?: string;
}

export interface UserUnbannedEvent {
  id: string;
  user: {
    id: number;
    username: string;
    slug: string;
  };
  unbanned_by: {
    id: number;
    username: string;
    slug: string;
  };
}

export interface PollUpdateEvent {
  poll: {
    title: string;
    options: { id: number; label: string; votes: number }[];
    duration: number;
    remaining: number;
    result_display_duration: number;
    has_voted: boolean;
    voted_option_id: number | null;
  };
}

export interface PollDeleteEvent {
  poll_id: string;
}

export interface PinnedMessageCreatedEvent {
  message: {
    id: string;
    chatroom_id: number;
    content: string;
    type: string;
    created_at: string;
    sender: {
      id: number;
      username: string;
      slug: string;
      identity: {
        color: string;
        badges: Array<{
          type: string;
          text: string;
          count?: number;
        }>;
      };
    };
    metadata: null;
  };
  duration: number;
}

export interface FollowersUpdatedEvent {
  followers_count: number;
  channel_id: number;
  username: string;
  followed: boolean;
  created_at: number;
}

export interface StreamerIsLiveEvent {
  livestream: {
    id: number;
    channel_id: number;
    session_title?: string | null;
    created_at: string;
  };
}

export interface StopStreamBroadcastEvent {
  livestream: {
    id: number;
    channel: {
      id: number;
      is_banned: boolean;
    };
  };
}

export interface KicksGiftedEvent {
  message: string;
  sender: {
    id: number;
    username: string;
    slug: string;
    identity: { color: string; badges: unknown };
  };
  gift: {
    gift_id: string;
    name: string;
    amount: number;
    type: string;
    tier: string;
    character_limit: number;
    pinned_time: number;
  };
}

export interface GiftsLeaderboardEntry {
  user_id: number;
  username: string;
  quantity: number;
}

export interface GiftsLeaderboardUpdatedEvent {
  channel: {
    id: number;
    slug: string;
    user_id: number;
    playback_url: string;
    vod_enabled: boolean;
    subscription_enabled: boolean;
  };
  gifter_username: string;
  gifter_id: number;
  gifted_quantity: number;
  leaderboard: GiftsLeaderboardEntry[];
  weekly_leaderboard: GiftsLeaderboardEntry[];
  monthly_leaderboard: GiftsLeaderboardEntry[];
}

export interface RewardRedeemedEvent {
  reward_title: string;
  user_id: number;
  channel_id: number;
  username: string;
  user_input?: string | null;
  reward_background_color: string;
}
