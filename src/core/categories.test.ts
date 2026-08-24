import { beforeEach, describe, expect, it, vi } from "vitest";

type MockResponse = { status: number; statusText?: string; data: unknown };

const axiosGet = vi.hoisted(() =>
  vi.fn<(args: unknown[]) => Promise<MockResponse>>(async () => ({
    status: 200,
    data: {},
  })),
);

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign({}, actual.default, { get: axiosGet }),
  };
});

import {
  getAllSubCategories,
  getCategories,
  getSubCategories,
  getSubCategory,
  getTopCategories,
} from "./categories";

describe("getCategories", () => {
  it("fetches the categories list", async () => {
    const categories = [
      { id: 1, name: "Just Chatting", slug: "just-chatting", icon: "i" },
    ];
    axiosGet.mockResolvedValue({ status: 200, data: categories });

    const result = await getCategories();

    expect(result).toEqual(categories);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/categories",
      expect.anything(),
    );
  });
});

describe("getTopCategories", () => {
  it("fetches the top categories list", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: [] });

    await getTopCategories();

    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/categories/top",
      expect.anything(),
    );
  });
});

describe("getSubCategories", () => {
  beforeEach(() => {
    axiosGet.mockClear();
  });

  it("requests the default page size", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

    await getSubCategories();

    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/subcategories?limit=10",
      expect.anything(),
    );
  });

  it("appends both limit and page when provided", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

    await getSubCategories(25, 3);

    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/subcategories?limit=25&page=3",
      expect.anything(),
    );
  });

  it("validates pagination bounds", () => {
    expect(() => getSubCategories(0)).toThrow(
      "perPage must be a finite number of at least 1",
    );
    expect(() => getSubCategories(Number.NaN)).toThrow(
      "perPage must be a finite number of at least 1",
    );
    expect(() => getSubCategories(10, 0)).toThrow(
      "page must be a finite number of at least 1",
    );
  });
});

describe("getSubCategory", () => {
  it("fetches a single subcategory by slug with URL encoding", async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { id: 4, slug: "gta v" } });

    const result = await getSubCategory("gta v");

    expect(result).toEqual({ id: 4, slug: "gta v" });
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/subcategories/gta%20v",
      expect.anything(),
    );
  });
});

describe("getAllSubCategories", () => {
  it("fetches the full subcategory list", async () => {
    const simple = [{ id: 1, name: "IRL", slug: "irl" }];
    axiosGet.mockResolvedValue({ status: 200, data: simple });

    const result = await getAllSubCategories();

    expect(result).toEqual(simple);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://kick.com/api/v1/listsubcategories",
      expect.anything(),
    );
  });
});
