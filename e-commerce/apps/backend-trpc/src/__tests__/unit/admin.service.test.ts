/**
 * admin.service.test.ts — Whitebox Unit Test
 * File ini SAMA untuk REST dan tRPC (service identik).
 *   REST : backend-rest/src/__tests__/unit/admin.service.test.ts
 *   tRPC : backend-trpc/src/__tests__/unit/admin.service.test.ts
 *
 * FIX v2:
 *  [1] getDashboardStats() — service sekarang pakai prisma.$queryRaw untuk salesChart
 *      (FIX #3: DATE_TRUNC per hari, bukan groupBy exact timestamp).
 *      prisma.$queryRaw HARUS ada di mock object. groupBy tidak lagi dipanggil service.
 *
 *  [2] updateProduct() "throw 404" — service sekarang TIDAK panggil findUnique dulu.
 *      Langsung update(), tangkap error Prisma P2025 → AppError 404.
 *      Mock update() harus dikonfigurasi throw { code: "P2025" } untuk simulate not-found.
 *
 *  [3] deleteProduct() "throw 404" — sama dengan updateProduct().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ─────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    order: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
      aggregate:  vi.fn(),
      // groupBy dihapus — service tidak memanggil groupBy lagi (FIX #3)
    },
    product: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
      create:     vi.fn(),
    },
    user: {
      count:    vi.fn(),
      findMany: vi.fn(),
    },
    // FIX [1]: $queryRaw WAJIB ada — dipanggil service untuk salesChart
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma } from "../../config/database";
import {
  getDashboardStats,
  getAllProducts  as getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllOrders    as getAdminOrders,
  updateOrderStatus,
  getAllUsers     as getAdminUsers,
} from "../../services/admin.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockOrder   = prisma.order   as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockProduct = prisma.product as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockUser    = prisma.user    as unknown as Record<string, ReturnType<typeof vi.fn>>;
// FIX [1]: akses $queryRaw via cast — tidak ada di Prisma type tapi ada di mock
const mockQueryRaw = (prisma as any).$queryRaw as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const fakeProduct = (overrides = {}) => ({
  id: "prod-1", name: "Produk Test", slug: "produk-test",
  price: 100_000, stock: 50, isActive: true, updatedAt: new Date(),
  ...overrides,
});

const fakeOrder = (overrides = {}) => ({
  id: "order-1", orderNumber: "ORD-001",
  status: "pending_payment", total: 500_000,
  createdAt: new Date(), user: { name: "Budi", email: "b@test.com" },
  ...overrides,
});

const fakeUser = (overrides = {}) => ({
  id: "user-1", name: "Budi", email: "b@test.com",
  role: "USER", createdAt: new Date(),
  _count: { orders: 3 },
  ...overrides,
});

// Helper setup semua mocks untuk getDashboardStats()
function setupDashboardMocks() {
  // FIX [1]: $queryRaw menggantikan order.groupBy untuk salesChart
  mockQueryRaw.mockResolvedValue([]);   // default: salesChart kosong

  mockOrder.count
    .mockResolvedValueOnce(5)           // total orders hari ini
    .mockResolvedValueOnce(100);        // total orders keseluruhan
  mockOrder.aggregate.mockResolvedValue({ _sum: { total: 5_000_000 } });
  mockOrder.findMany.mockResolvedValue([fakeOrder()]);

  mockProduct.count.mockResolvedValue(200);
  mockProduct.findMany.mockResolvedValue([fakeProduct()]);

  mockUser.count.mockResolvedValue(50);
}

// =============================================================================
// getDashboardStats()
// =============================================================================
describe("getDashboardStats()", () => {
  it("✅ return shape dengan summary, topProducts, recentOrders, salesChart", async () => {
    setupDashboardMocks();

    const result = await getDashboardStats();

    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("topProducts");
    expect(result).toHaveProperty("recentOrders");
    expect(result).toHaveProperty("salesChart");
  });

  it("✅ summary berisi semua field yang dibutuhkan dashboard", async () => {
    setupDashboardMocks();

    const result = await getDashboardStats();

    expect(result.summary).toHaveProperty("totalOrdersToday");
    expect(result.summary).toHaveProperty("weeklyRevenue");
    expect(result.summary).toHaveProperty("totalProducts");
    expect(result.summary).toHaveProperty("totalUsers");
    expect(result.summary.totalOrdersToday).toBe(5);
    expect(result.summary.weeklyRevenue).toBe(5_000_000);
    expect(result.summary.totalProducts).toBe(200);
    expect(result.summary.totalUsers).toBe(50);
  });

  it("✅ weeklyRevenue dikonversi ke Number (bukan string/Decimal)", async () => {
    setupDashboardMocks();

    const result = await getDashboardStats();

    expect(typeof result.summary.weeklyRevenue).toBe("number");
  });

  it("✅ weeklyRevenue default 0 jika aggregate return null", async () => {
    setupDashboardMocks();
    mockOrder.aggregate.mockResolvedValue({ _sum: { total: null } });

    const result = await getDashboardStats();

    expect(result.summary.weeklyRevenue).toBe(0);
  });

  it("✅ salesChart adalah array (kosong jika tidak ada transaksi)", async () => {
    setupDashboardMocks();
    // mockQueryRaw sudah di-set ke [] di setupDashboardMocks()

    const result = await getDashboardStats();

    expect(Array.isArray(result.salesChart)).toBe(true);
  });

  it("✅ salesChart item memiliki date, revenue (number), dan orders (number)", async () => {
    setupDashboardMocks();
    // FIX [1]: override $queryRaw untuk test ini dengan data nyata
    mockQueryRaw.mockResolvedValue([
      { date: new Date("2025-05-15"), revenue: 150_000, orders: 3 },
    ]);

    const result = await getDashboardStats();

    expect(result.salesChart).toHaveLength(1);
    expect(result.salesChart[0]).toHaveProperty("date");
    expect(result.salesChart[0]).toHaveProperty("revenue");
    expect(result.salesChart[0]).toHaveProperty("orders");
    // revenue dan orders harus number (Number() normalization)
    expect(typeof result.salesChart[0].revenue).toBe("number");
    expect(typeof result.salesChart[0].orders).toBe("number");
    expect(result.salesChart[0].revenue).toBe(150_000);
    expect(result.salesChart[0].orders).toBe(3);
  });

  it("✅ $queryRaw dipanggil untuk salesChart (bukan groupBy)", async () => {
    // FIX [1]: verifikasi bahwa service memanggil $queryRaw, bukan groupBy
    setupDashboardMocks();

    await getDashboardStats();

    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });

  it("✅ topProducts price adalah number (bukan Decimal string)", async () => {
    setupDashboardMocks();
    mockProduct.findMany.mockResolvedValue([
      fakeProduct({ price: { toNumber: () => 100_000 } }),   // simulate Prisma Decimal
    ]);

    const result = await getDashboardStats();

    // Setelah Number() normalization, harus number
    result.topProducts.forEach((p: any) => {
      expect(typeof p.price).toBe("number");
    });
  });

  it("✅ recentOrders total adalah number (bukan Decimal string)", async () => {
    setupDashboardMocks();
    mockOrder.findMany.mockResolvedValue([
      fakeOrder({ total: { toNumber: () => 500_000 } }),   // simulate Prisma Decimal
    ]);

    const result = await getDashboardStats();

    result.recentOrders.forEach((o: any) => {
      expect(typeof o.total).toBe("number");
    });
  });
});

// =============================================================================
// getAdminProducts()
// =============================================================================
describe("getAdminProducts()", () => {
  it("✅ return daftar produk dengan pagination", async () => {
    mockProduct.count.mockResolvedValue(50);
    mockProduct.findMany.mockResolvedValue([fakeProduct()]);

    const result = await getAdminProducts({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.totalCount).toBe(50);
  });

  it("✅ filter by keyword q jika diberikan", async () => {
    mockProduct.count.mockResolvedValue(2);
    mockProduct.findMany.mockResolvedValue([fakeProduct()]);

    await getAdminProducts({ q: "sepatu", page: 1, limit: 20 });

    const where = mockProduct.findMany.mock.calls[0][0].where;
    expect(where).toHaveProperty("name");
  });
});

// =============================================================================
// createProduct()
// =============================================================================
describe("createProduct()", () => {
  const newProductData = {
    name: "Produk Baru", slug: "produk-baru",
    price: 200_000, stock: 100, categoryId: "cat-1",
    description: "Desc", images: [],
  };

  it("✅ berhasil create produk baru", async () => {
    mockProduct.create.mockResolvedValue(fakeProduct({ name: "Produk Baru" }));

    const result = await createProduct(newProductData);

    expect(result.name).toBe("Produk Baru");
    expect(mockProduct.create).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// updateProduct()
// =============================================================================
describe("updateProduct()", () => {
  it("✅ berhasil update produk", async () => {
    mockProduct.update.mockResolvedValue(fakeProduct({ price: 120_000 }));

    const result = await updateProduct("prod-1", { price: 120_000 });

    expect(result.price).toBe(120_000);
    expect(mockProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data:  expect.objectContaining({ price: 120_000 }),
      })
    );
  });

  it("✅ throw 404 jika produk tidak ditemukan (P2025 catch pattern)", async () => {
    // FIX [2]: service tidak memanggil findUnique lagi.
    // Langsung update() dan tangkap P2025 → AppError 404.
    // Mock update() harus throw { code: "P2025" } untuk simulate not-found.
    mockProduct.update.mockRejectedValue({ code: "P2025" });

    await expect(updateProduct("ghost-prod", { price: 100 }))
      .rejects.toMatchObject({ status: 404 });

    // update() harus dipanggil (service langsung update, tidak findUnique dulu)
    expect(mockProduct.update).toHaveBeenCalledOnce();
    // findUnique TIDAK dipanggil (pattern baru: tidak ada extra findUnique)
    expect(mockProduct.findUnique).not.toHaveBeenCalled();
  });

  it("✅ error non-P2025 tetap di-rethrow apa adanya", async () => {
    const dbConnectionError = new Error("DB connection lost");
    mockProduct.update.mockRejectedValue(dbConnectionError);

    await expect(updateProduct("prod-1", { price: 100 }))
      .rejects.toThrow("DB connection lost");
  });
});

// =============================================================================
// deleteProduct()
// =============================================================================
describe("deleteProduct()", () => {
  it("✅ berhasil delete (soft delete: isActive = false)", async () => {
    mockProduct.update.mockResolvedValue(fakeProduct({ isActive: false }));

    await deleteProduct("prod-1");

    expect(mockProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data:  expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("✅ throw 404 jika produk tidak ditemukan (P2025 catch pattern)", async () => {
    // FIX [3]: sama dengan updateProduct — langsung update(), catch P2025 → 404
    mockProduct.update.mockRejectedValue({ code: "P2025" });

    await expect(deleteProduct("ghost-prod"))
      .rejects.toMatchObject({ status: 404 });

    expect(mockProduct.update).toHaveBeenCalledOnce();
    expect(mockProduct.findUnique).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getAdminOrders()
// =============================================================================
describe("getAdminOrders()", () => {
  it("✅ return semua order dengan pagination", async () => {
    mockOrder.count.mockResolvedValue(10);
    mockOrder.findMany.mockResolvedValue([fakeOrder()]);

    const result = await getAdminOrders({ page: 1, limit: 20 });

    expect(result.orders).toHaveLength(1);
    expect(result.totalCount).toBe(10);
  });

  it("✅ filter by status jika disertakan", async () => {
    mockOrder.count.mockResolvedValue(3);
    mockOrder.findMany.mockResolvedValue([fakeOrder({ status: "confirmed" })]);

    await getAdminOrders({ status: "confirmed", page: 1, limit: 20 });

    const where = mockOrder.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("confirmed");
  });
});

// =============================================================================
// updateOrderStatus()
// =============================================================================
describe("updateOrderStatus()", () => {
  it("✅ berhasil update status order ke confirmed", async () => {
    mockOrder.findUnique.mockResolvedValue(fakeOrder({ status: "pending_payment" }));
    mockOrder.update.mockResolvedValue(fakeOrder({ status: "confirmed" }));

    const result = await updateOrderStatus("order-1", "confirmed");

    expect(result.status).toBe("confirmed");
  });

  it("✅ throw 404 jika order tidak ditemukan", async () => {
    mockOrder.findUnique.mockResolvedValue(null);

    await expect(updateOrderStatus("ghost-order", "confirmed"))
      .rejects.toMatchObject({ status: 404 });
    expect(mockOrder.update).not.toHaveBeenCalled();
  });

  it("✅ throw 400 jika transisi status tidak valid (state machine)", async () => {
    // "shipped" tidak bisa langsung ke "pending_payment" (state machine)
    mockOrder.findUnique.mockResolvedValue(fakeOrder({ status: "shipped" }));

    await expect(updateOrderStatus("order-1", "pending_payment"))
      .rejects.toMatchObject({ status: 400 });
  });
});

// =============================================================================
// getAdminUsers()
// =============================================================================
describe("getAdminUsers()", () => {
  it("✅ return daftar user dengan jumlah order (_count)", async () => {
    mockUser.count.mockResolvedValue(5);
    mockUser.findMany.mockResolvedValue([fakeUser()]);

    const result = await getAdminUsers({ page: 1, limit: 20 });

    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toHaveProperty("_count");
    expect(result.users[0]._count.orders).toBe(3);
  });

  it("✅ return total user count untuk pagination", async () => {
    mockUser.count.mockResolvedValue(42);
    mockUser.findMany.mockResolvedValue([]);

    const result = await getAdminUsers({ page: 1, limit: 20 });

    expect(result.totalCount).toBe(42);
  });
});