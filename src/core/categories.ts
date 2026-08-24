import {
  type KickCategory,
  type SimpleSubCategory,
  type SubCategory,
  type SubCategoryPage,
} from "../types/categories";
import { fetchJson, fetchJsonArray, KICK_API_BASE } from "./kick-api";

export const getCategories = (): Promise<KickCategory[]> =>
  fetchJsonArray<KickCategory>(
    `${KICK_API_BASE}/api/v1/categories`,
    "categories",
  );

export const getTopCategories = (): Promise<SubCategory[]> =>
  fetchJsonArray<SubCategory>(
    `${KICK_API_BASE}/api/v1/categories/top`,
    "top categories",
  );

export const getSubCategories = (
  perPage: number = 10,
  page?: number,
): Promise<SubCategoryPage> => {
  if (!Number.isFinite(perPage) || perPage < 1) {
    throw new Error("perPage must be a finite number of at least 1");
  }

  const query: Record<string, string> = { limit: perPage.toString() };
  if (page !== undefined) {
    if (!Number.isFinite(page) || page < 1) {
      throw new Error("page must be a finite number of at least 1");
    }

    query.page = page.toString();
  }

  return fetchJson<SubCategoryPage>(
    `${KICK_API_BASE}/api/v1/subcategories`,
    "sub categories",
    undefined,
    query,
  );
};

export const getSubCategory = (slug: string): Promise<SubCategory> =>
  fetchJson<SubCategory>(
    `${KICK_API_BASE}/api/v1/subcategories/${encodeURIComponent(slug)}`,
    "sub category",
  );

export const getAllSubCategories = (): Promise<SimpleSubCategory[]> =>
  fetchJsonArray<SimpleSubCategory>(
    `${KICK_API_BASE}/api/v1/listsubcategories`,
    "all sub categories",
  );
