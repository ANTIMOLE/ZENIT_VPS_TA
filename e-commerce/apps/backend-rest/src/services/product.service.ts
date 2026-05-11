import { getCached } from "@ecommerce/shared";
import { prisma } from "../config/database";
import { AppError } from "../middlewares/error.middleware";

export interface ProductQuery {
  page?:       number;
  limit?:      number;
  categoryId?: string;
  q?:          string;
  minPrice?:   number;
  maxPrice?:   number;
  minRating?:  number;
  sortBy?:     "price" | "rating" | "soldCount" | "createdAt" | "sold_count" | "created_at";
  sortOrder?:  "asc" | "desc";
}

const SORT_MAP: Record<string, "price" | "rating" | "soldCount" | "createdAt"> = {
  created_at: "createdAt",
  createdAt:  "createdAt",
  sold_count: "soldCount",
  soldCount:  "soldCount",
  price:      "price",
  rating:     "rating",
};

function buildTsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join(" & ");
}

const PRODUCT_LIST_SELECT = {
  id:        true,
  name:      true,
  slug:      true,
  price:     true,
  images:    true,
  rating:    true,
  soldCount: true,
  location:  true,
  discount:  true,
  stock:     true,
  category:  { select: { id: true, name: true, slug: true } },
} as const;

const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  description: true,
  createdAt:   true,
} as const;

function buildWhere(query: ProductQuery) {
  const { categoryId, q, minPrice, maxPrice, minRating } = query;
  return {
    isActive: true,
    ...(categoryId && { categoryId }),
    ...(q && q.trim().length > 0 && {
      name: { search: buildTsQuery(q) },
    }),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        }
      : {}),
    ...(minRating !== undefined && { rating: { gte: minRating } }),
  };
}

async function fetchProducts(query: ProductQuery) {
  const {
    page      = 1,
    limit     = 20,
    sortBy    = "createdAt",
    sortOrder = "desc",
  } = query;

  const finalSortBy = SORT_MAP[sortBy] ?? "createdAt";
  const where = buildWhere(query);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select:  PRODUCT_LIST_SELECT,
      orderBy: { [finalSortBy]: sortOrder },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    data:        products,
    totalCount:  total,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export async function getAll(query: ProductQuery) {
  const key = `products:list:${JSON.stringify(query)}`;
  return getCached(key, 60, () => fetchProducts(query));
}

export async function getBySlug(slug: string) {
  return getCached(`product:slug:${slug}`, 300, async () => {
    const product = await prisma.product.findFirst({
      where:  { slug, isActive: true },
      select: PRODUCT_DETAIL_SELECT,
    });
    if (!product) throw new AppError("Produk tidak ditemukan.", 404);
    return product;
  });
}

export async function getById(id: string) {
  return getCached(`product:id:${id}`, 300, async () => {
    const product = await prisma.product.findUnique({
      where:  { id },
      select: PRODUCT_DETAIL_SELECT,
    });
    if (!product) throw new AppError("Produk tidak ditemukan.", 404);
    return product;
  });
}

export async function search(keyword: string, query?: Omit<ProductQuery, "q">) {
  const key = `products:search:${keyword}:${JSON.stringify(query ?? {})}`;
  return getCached(key, 120, () => getAll({ ...query, q: keyword }));
}