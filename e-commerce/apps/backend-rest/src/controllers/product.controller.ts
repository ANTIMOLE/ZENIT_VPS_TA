import type { Request, Response, NextFunction } from "express";
import * as productService from "../services/product.service";

// Whitelist sortBy yang valid — sesuai dengan SORT_MAP di product.service.ts.
// FIX: sebelumnya `sortBy: req.query.sortBy as any` tanpa validasi.
// Kalau user kirim sortBy=__proto__ atau field tidak ada ? Prisma runtime error.
// Dengan whitelist ini, nilai tidak dikenal di-default ke undefined ? service pakai "createdAt".
const VALID_SORT_BY = new Set([
  "price", "rating", "soldCount", "createdAt", "sold_count", "created_at",
]);

const VALID_SORT_ORDER = new Set(["asc", "desc"]);

// ============================================================
// GET /products
// ============================================================
export async function getAllController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawSortBy    = req.query.sortBy    as string | undefined;
    const rawSortOrder = req.query.sortOrder as string | undefined;

    const query = {
      page:       req.query.page      ? Number(req.query.page)      : undefined,
      limit:      req.query.limit     ? Number(req.query.limit)     : undefined,
      categoryId: req.query.categoryId as string | undefined,
      q:          req.query.q          as string | undefined,
      minPrice:   req.query.minPrice   ? Number(req.query.minPrice)  : undefined,
      maxPrice:   req.query.maxPrice   ? Number(req.query.maxPrice)  : undefined,
      minRating:  req.query.minRating  ? Number(req.query.minRating) : undefined,
      // FIX: whitelist check — nilai di luar set diabaikan (undefined ? default di service)
      sortBy:     (rawSortBy    && VALID_SORT_BY.has(rawSortBy))       ? rawSortBy    as any : undefined,
      sortOrder:  (rawSortOrder && VALID_SORT_ORDER.has(rawSortOrder)) ? rawSortOrder as any : undefined,
    };

    const result = await productService.getAll(query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET /products/:slug
// ============================================================
export async function getBySlugController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const product = await productService.getBySlug(req.params.slug as string);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET /products/search?q=keyword
// ============================================================
export async function searchController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const keyword = req.query.q as string | undefined;
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }

    const rawSortBy    = req.query.sortBy    as string | undefined;
    const rawSortOrder = req.query.sortOrder as string | undefined;

    const query = {
      page:       req.query.page      ? Number(req.query.page)      : undefined,
      limit:      req.query.limit     ? Number(req.query.limit)     : undefined,
      categoryId: req.query.categoryId as string | undefined,
      minPrice:   req.query.minPrice   ? Number(req.query.minPrice)  : undefined,
      maxPrice:   req.query.maxPrice   ? Number(req.query.maxPrice)  : undefined,
      minRating:  req.query.minRating  ? Number(req.query.minRating) : undefined,
      sortBy:     (rawSortBy    && VALID_SORT_BY.has(rawSortBy))       ? rawSortBy    as any : undefined,
      sortOrder:  (rawSortOrder && VALID_SORT_ORDER.has(rawSortOrder)) ? rawSortOrder as any : undefined,
    };

    const result = await productService.search(keyword.trim(), query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}