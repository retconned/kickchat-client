export interface ClipCreator {
  id: number;
  username: string;
  slug: string;
  profile_picture: string | null;
}

export interface ClipChannel {
  id: number;
  username: string;
  slug: string;
  profile_picture: string | null;
}

export interface ClipCategory {
  id: number;
  name: string;
  slug: string;
  responsive: string | null;
  banner: string | null;
  parent_category: string | null;
}

export interface Clip {
  id: string;
  is_mature: boolean;
  title: string;
  duration: number;
  thumbnail_url: string;
  video_url: string;
  view_count: number;
  likes_count: number;
  liked: boolean;
  created_at: string;
  creator: ClipCreator | null;
  channel: ClipChannel | null;
  category: ClipCategory | null;
}

export interface ClipFeed {
  clips: Clip[];
  next_cursor?: string | null;
}
