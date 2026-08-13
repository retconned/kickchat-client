export type VideoInfo = {
  id: number;
  live_stream_id: number;
  slug: null;
  thumb: null;
  s3: null;
  trading_platform_id: null;
  created_at: string;
  updated_at: string;
  uuid: string;
  views: number;
  deleted_at: null;
  source: string;
  livestream: Livestream | null;
};

export type Livestream = {
  id: number;
  slug: string;
  channel_id: number;
  created_at: string;
  session_title: string;
  is_live: boolean;
  risk_level_id: null;
  start_time: string;
  source: null;
  twitch_channel: null;
  duration: number;
  language: string;
  is_mature: boolean;
  viewer_count: number;
  thumbnail: string;
  channel: Channel;
  categories: CategoryElement[];
};

export type CategoryElement = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  tags: string[];
  description: null;
  deleted_at: null;
  viewers: number;
  category: CategoryCategory;
};

export type CategoryCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string;
};

export type Channel = {
  id: number;
  user_id: number;
  slug: string;
  is_banned: boolean;
  playback_url: string;
  name_updated_at: null;
  vod_enabled: boolean;
  subscription_enabled: boolean;
  followersCount: number;
  user: User;
  can_host: boolean;
  verified: Verified;
};

export type User = {
  profilepic: string;
  bio: string;
  twitter: string;
  facebook: string;
  instagram: string;
  youtube: string;
  discord: string;
  tiktok: string;
  username: string;
};

export type Verified = {
  id: number;
  channel_id: number;
  created_at: string;
  updated_at: string;
};
