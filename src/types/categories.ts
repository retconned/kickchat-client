export interface KickCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

export interface SubCategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  tags: string[];
  description: string | null;
  deleted_at: string | null;
  viewers: number;
  followers_count: number;
  followed: boolean;
  banner: CategoryBanner | null;
}

export interface SimpleSubCategory {
  id: number;
  name: string;
  slug: string;
}

export interface CategoryBanner {
  responsive: string | null;
  url: string | null;
}

export interface SubCategoryPage {
  data: SubCategory[];
  current_page: number;
  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  next_page_url: string | null;
  path: string;
  per_page: string;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}
