/**
 * category.service.test.ts — Whitebox Unit Test
 * File ini SAMA untuk REST dan tRPC (service identik).
 *   REST : backend-rest/src/__tests__/unit/category.service.test.ts
 *   tRPC : backend-trpc/src/__tests__/unit/category.service.test.ts
 *
 * FIX v2:
 *  [1] Cache pollution fix — tambah vi.mock("@ecommerce/shared") agar getCached()
 *      selalu call-through ke function aslinya, TIDAK menyimpan cache antar test.
 *
 *      Root cause: category.service.ts memakai getCached("categories:all", 600, fn).
 *      Semua getAll() calls pakai cache key yang SAMA. Tanpa mock, test pertama mengisi
 *      cache, test berikutnya return dari cache tanpa memanggil prisma.category.findMany.
 *      findMany.mock.calls[0] menjadi undefined → test gagal dengan TypeError.
 *
 *      Fix: getCached di-mock sebagai passthrough — selalu call fn(), tidak pernah cache.
 *      Ini murni test isolation concern, bukan perubahan service behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ────────────────────────────────────────────────────────────────────

// FIX [1]: Mock getCached sebagai passthrough. Tanpa ini, cache bertahan antar test
// dalam file yang sama → tes berikutnya tidak hit prisma mock → .mock.calls[0] undefined.
vi.mock("@ecommerce/shared", () => ({
  getCached: async (_key: string, _ttl: number, fn: () => Promise<any>) => fn(),
}));

vi.mock("../../config/database", () => ({
  prisma: {
    category: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma }               from "../../config/database";
import { getAll, getBySlug }    from "../../services/category.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockCategory = prisma.category as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const fakeCategory = {
  id:          "cat-1",
  name:        "Elektronik",
  slug:        "elektronik",
  description: "Produk elektronik",
  _count:      { products: 5 },
};

// =============================================================================
// getAll()
// =============================================================================
describe("getAll()", () => {
  it("✅ return semua kategori sorted by name asc", async () => {
    mockCategory.findMany.mockResolvedValue([fakeCategory]);

    const result = await getAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slug: "elektronik" });
    expect(mockCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } })
    );
  });

  it("✅ return array kosong jika tidak ada kategori", async () => {
    // FIX [1]: tanpa getCached mock, test ini akan return [fakeCategory] dari cache
    // test pertama. Dengan mock passthrough, findMany dipanggil fresh → return [].
    mockCategory.findMany.mockResolvedValue([]);

    const result = await getAll();

    expect(result).toHaveLength(0);
  });

  it("✅ query select mengandung _count untuk hitung produk aktif", async () => {
    // FIX [1]: tanpa mock passthrough, findMany tidak dipanggil di sini (hasil dari cache)
    // → mock.calls[0] undefined → TypeError. Dengan mock passthrough, selalu dipanggil.
    mockCategory.findMany.mockResolvedValue([fakeCategory]);

    await getAll();

    const selectArg = mockCategory.findMany.mock.calls[0][0].select;
    // _count dipakai untuk hitung jumlah produk per kategori tanpa N+1 query
    expect(selectArg).toHaveProperty("_count");
    expect(selectArg._count.select.products.where).toMatchObject({ isActive: true });
  });

  it("✅ response item mengandung _count field dari DB", async () => {
    mockCategory.findMany.mockResolvedValue([fakeCategory]);

    const result = await getAll();

    expect(result[0]).toHaveProperty("_count");
    expect(result[0]._count.products).toBe(5);
  });

  it("✅ prisma.category.findMany dipanggil setiap call (getCached passthrough di test)", async () => {
    // Verifikasi mock passthrough bekerja: setiap getAll() memanggil findMany
    mockCategory.findMany.mockResolvedValue([fakeCategory]);

    await getAll();
    await getAll();

    // Dipanggil 2x karena getCached di-mock sebagai passthrough
    expect(mockCategory.findMany).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// getBySlug()
// =============================================================================
describe("getBySlug()", () => {
  it("✅ return kategori yang ditemukan berdasarkan slug", async () => {
    mockCategory.findUnique.mockResolvedValue(fakeCategory);

    const result = await getBySlug("elektronik");

    expect(result.slug).toBe("elektronik");
    expect(result.name).toBe("Elektronik");
    expect(mockCategory.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "elektronik" } })
    );
  });

  it("✅ throw 404 jika slug tidak ditemukan", async () => {
    mockCategory.findUnique.mockResolvedValue(null);

    await expect(getBySlug("tidak-ada"))
      .rejects.toMatchObject({ status: 404, message: "Kategori tidak ditemukan." });
  });

  it("✅ query include _count untuk produk aktif", async () => {
    mockCategory.findUnique.mockResolvedValue(fakeCategory);

    await getBySlug("elektronik");

    const selectArg = mockCategory.findUnique.mock.calls[0][0].select;
    expect(selectArg).toHaveProperty("_count");
    expect(selectArg._count.select.products.where).toMatchObject({ isActive: true });
  });

  it("✅ getBySlug dipanggil independent dari getAll (cache key berbeda)", async () => {
    // getBySlug pakai key "categories:slug:elektronik" — bukan "categories:all"
    // Tidak ada interference dengan getAll() cache
    mockCategory.findUnique.mockResolvedValue(fakeCategory);

    const result = await getBySlug("elektronik");

    expect(result).toBeTruthy();
    expect(mockCategory.findUnique).toHaveBeenCalledOnce();
  });
});