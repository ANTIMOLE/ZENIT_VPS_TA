/**
 * product.service.test.ts — Whitebox Unit Test
 * File ini SAMA untuk REST dan tRPC (service identik).
 *   REST : backend-rest/src/__tests__/unit/product.service.test.ts
 *   tRPC : backend-trpc/src/__tests__/unit/product.service.test.ts
 *
 * FIX v2:
 *  [1] Filter by q — service sekarang pakai PostgreSQL FTS: name: { search: buildTsQuery(q) }
 *      BUKAN lagi { contains: q } atau { contains: q, mode: "insensitive" }.
 *      buildTsQuery("kata") = "kata" (satu kata)
 *      buildTsQuery("laptop gaming") = "laptop & gaming" (multi kata → tsquery format)
 *
 * Catatan: @ecommerce/shared tidak di-mock → getCached() berjalan nyata.
 * Jika getCached() miss → memanggil function yang menggunakan prisma mock.
 * Potensi cache pollution antar test diminimalisir dengan query params yang berbeda.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    product: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma } from "../../config/database";
import * as productService from "../../services/product.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockCount     = prisma.product.count     as ReturnType<typeof vi.fn>;
const mockFindMany  = prisma.product.findMany  as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.product.findFirst as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.product.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const fakeProduct = {
  id: "prod-1", name: "Sepatu Lari Nike", slug: "sepatu-lari-nike",
  price: 500_000, discount: 0, stock: 50, rating: 4.5,
  soldCount: 100, location: "Jakarta", images: ["img.jpg"],
  category: { id: "cat-1", name: "Sepatu", slug: "sepatu" },
};

// =============================================================================
// getAll()
// =============================================================================
describe("productService.getAll()", () => {
  it("✅ return data dengan pagination shape yang benar", async () => {
    mockCount.mockResolvedValue(25);
    mockFindMany.mockResolvedValue([fakeProduct]);

    // Pakai query unik untuk hindari cache pollution
    const result = await productService.getAll({ page: 1, limit: 10, minPrice: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.totalCount).toBe(25);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(false);
  });

  it("✅ filter isActive: true selalu ada di where clause", async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await productService.getAll({ page: 2, limit: 5 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.isActive).toBe(true);
  });

  it("✅ filter by categoryId jika disertakan", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ categoryId: "cat-electronics", page: 1 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.categoryId).toBe("cat-electronics");
  });

  it("✅ filter by q pakai PostgreSQL FTS: name.search (bukan contains)", async () => {
    // FIX [1]: service memakai { name: { search: buildTsQuery(q) } }
    // BUKAN { name: { contains: q } } atau { name: { contains: q, mode: "insensitive" } }
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ q: "nikefts1", page: 3 });  // query unik per test

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    // Harus pakai { search } bukan { contains }
    expect(where?.name).toHaveProperty("search");
    expect(where?.name).not.toHaveProperty("contains");
    // buildTsQuery("nikefts1") = "nikefts1" (single word, tidak berubah)
    expect(where?.name.search).toBe("nikefts1");
  });

  it("✅ buildTsQuery multi-kata menggunakan format tsquery (& antar kata)", async () => {
    // "laptop gaming" → "laptop & gaming" (PostgreSQL tsquery AND operator)
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    await productService.getAll({ q: "laptop gaming", page: 1, minRating: 1 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.name.search).toBe("laptop & gaming");
  });

  it("✅ filter by minPrice dan maxPrice", async () => {
    mockCount.mockResolvedValue(3);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ minPrice: 100_000, maxPrice: 500_000, page: 4 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.price?.gte).toBe(100_000);
    expect(where?.price?.lte).toBe(500_000);
  });

  it("✅ minPrice: 0 tetap diaplikasikan (bukan falsy check)", async () => {
    // Penting: minPrice = 0 adalah nilai valid. Jangan pakai if(minPrice) — harus !== undefined.
    mockCount.mockResolvedValue(5);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ minPrice: 0, maxPrice: 200_000, page: 5 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.price?.gte).toBe(0);
  });

  it("✅ sort field snake_case di-map ke camelCase Prisma (SORT_MAP)", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ sortBy: "sold_count", sortOrder: "desc", page: 6 });

    const orderBy = mockFindMany.mock.calls[0]?.[0]?.orderBy;
    // "sold_count" → "soldCount" via SORT_MAP
    expect(orderBy).toHaveProperty("soldCount", "desc");
    expect(orderBy).not.toHaveProperty("sold_count");
  });

  it("✅ sort field created_at di-map ke createdAt", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.getAll({ sortBy: "created_at", sortOrder: "asc", page: 7 });

    const orderBy = mockFindMany.mock.calls[0]?.[0]?.orderBy;
    expect(orderBy).toHaveProperty("createdAt", "asc");
    expect(orderBy).not.toHaveProperty("created_at");
  });

  it("✅ skip dihitung dari (page-1) * limit untuk paging yang benar", async () => {
    mockCount.mockResolvedValue(100);
    mockFindMany.mockResolvedValue([]);

    await productService.getAll({ page: 3, limit: 10, minPrice: 999 });

    const args = mockFindMany.mock.calls[0]?.[0];
    expect(args?.skip).toBe(20);   // (3-1) * 10
    expect(args?.take).toBe(10);
  });
});

// =============================================================================
// getBySlug()
// =============================================================================
describe("productService.getBySlug()", () => {
  it("✅ return produk yang ditemukan berdasarkan slug", async () => {
    mockFindFirst.mockResolvedValue(fakeProduct);

    const result = await productService.getBySlug("sepatu-lari-nike-unique-slug");

    expect(result.slug).toBe("sepatu-lari-nike");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "sepatu-lari-nike-unique-slug", isActive: true } })
    );
  });

  it("✅ throw 404 jika slug tidak ditemukan", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(productService.getBySlug("tidak-ada-slug-unik-999"))
      .rejects.toMatchObject({ status: 404 });
  });
});

// =============================================================================
// getById()
// =============================================================================
describe("productService.getById()", () => {
  it("✅ return produk berdasarkan id", async () => {
    mockFindUnique.mockResolvedValue(fakeProduct);

    const result = await productService.getById("prod-id-getbyid-unique");

    expect(result.id).toBe("prod-1");
  });

  it("✅ throw 404 jika id tidak ditemukan", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(productService.getById("ghost-id-unique-999"))
      .rejects.toMatchObject({ status: 404 });
  });
});

// =============================================================================
// search()
// =============================================================================
describe("productService.search()", () => {
  it("✅ meneruskan keyword sebagai q ke getAll() — filter name.search diisi", async () => {
    // FIX [1]: search() mendelegasi ke getAll() dengan q = keyword
    // where.name harus { search: "keyword" }, bukan { contains: "keyword" }
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.search("nikesearch99");   // query unik per test

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    // FIX [1]: harus pakai { search }, bukan { contains }
    expect(where?.name).toHaveProperty("search");
    expect(where?.name.search).toBe("nikesearch99");
    expect(where?.name).not.toHaveProperty("contains");
  });

  it("✅ search() bisa dikombinasikan dengan filter lain (minPrice, maxPrice)", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([fakeProduct]);

    await productService.search("samsung99", { minPrice: 1_000_000, maxPrice: 5_000_000 });

    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where?.name?.search).toBe("samsung99");
    expect(where?.price?.gte).toBe(1_000_000);
    expect(where?.price?.lte).toBe(5_000_000);
  });
});