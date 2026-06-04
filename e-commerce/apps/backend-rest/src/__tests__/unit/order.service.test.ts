/**
 * order.service.test.ts — Whitebox Unit Test
 * File ini SAMA untuk REST dan tRPC (service identik).
 *   REST : backend-rest/src/__tests__/unit/order.service.test.ts
 *   tRPC : backend-trpc/src/__tests__/unit/order.service.test.ts
 *
 * FIX v2:
 *  [1] confirmOrder() — service sekarang cukup 1x update langsung ke "confirmed"
 *      (FIX #6: hapus double UPDATE processing → confirmed).
 *      Test lama expect toHaveBeenCalledTimes(2) → sekarang (1).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    order: {
      findFirst:  vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      count:      vi.fn(),
      update:     vi.fn(),
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma } from "../../config/database";
import {
  getOrders,
  getOrderById,
  confirmOrder,
} from "../../services/order.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockOrder = prisma.order as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const fakeOrder = (overrides = {}) => ({
  id:            "order-1",
  userId:        "user-1",
  orderNumber:   "ORD-001",
  status:        "pending_payment",
  total:         455_000,    // sudah Number (Decimal normalization)
  subtotal:      400_000,
  tax:           44_000,
  shippingCost:  15_000,
  paymentMethod: "bank_transfer",
  shippingMethod:"regular",
  createdAt:     new Date("2024-01-10"),
  items:         [],
  ...overrides,
});

// =============================================================================
// getOrders()
// =============================================================================
describe("getOrders()", () => {
  it("✅ return daftar order user dengan pagination", async () => {
    mockOrder.count.mockResolvedValue(3);
    mockOrder.findMany.mockResolvedValue([fakeOrder()]);

    const result = await getOrders("user-1", {});

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(3);
  });

  it("✅ count dan findMany dijalankan paralel (Promise.all)", async () => {
    // Kedua mock resolves langsung — tidak ada dependensi urutan
    mockOrder.count.mockResolvedValue(0);
    mockOrder.findMany.mockResolvedValue([]);

    await getOrders("user-1", {});

    // Keduanya harus dipanggil (paralel, bukan sequential)
    expect(mockOrder.count).toHaveBeenCalledOnce();
    expect(mockOrder.findMany).toHaveBeenCalledOnce();
  });

  it("✅ total field adalah number (bukan Prisma Decimal)", async () => {
    mockOrder.count.mockResolvedValue(1);
    mockOrder.findMany.mockResolvedValue([fakeOrder({ total: 455_000 })]);

    const result = await getOrders("user-1", {});

    expect(typeof result.orders[0].total).toBe("number");
  });

  it("✅ filter hanya order milik userId yang diminta", async () => {
    mockOrder.count.mockResolvedValue(0);
    mockOrder.findMany.mockResolvedValue([]);

    await getOrders("user-1", {});

    const whereCount  = mockOrder.count.mock.calls[0][0].where;
    const whereFindMany = mockOrder.findMany.mock.calls[0][0].where;
    expect(whereCount.userId).toBe("user-1");
    expect(whereFindMany.userId).toBe("user-1");
  });

  it("✅ return array kosong jika tidak ada order", async () => {
    mockOrder.count.mockResolvedValue(0);
    mockOrder.findMany.mockResolvedValue([]);

    const result = await getOrders("user-1", {});

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// =============================================================================
// getOrderById()
// =============================================================================
describe("getOrderById()", () => {
  it("✅ return detail order milik user", async () => {
    mockOrder.findFirst.mockResolvedValue(fakeOrder());

    const result = await getOrderById("user-1", "order-1");

    expect(result.id).toBe("order-1");
    expect(result.orderNumber).toBe("ORD-001");
  });

  it("✅ throw 404 jika order tidak ditemukan", async () => {
    mockOrder.findFirst.mockResolvedValue(null);

    await expect(getOrderById("user-1", "ghost"))
      .rejects.toMatchObject({ status: 404 });
  });

  it("✅ hanya ambil order milik userId yang diminta (cegah IDOR)", async () => {
    mockOrder.findFirst.mockResolvedValue(fakeOrder());

    await getOrderById("user-1", "order-1");

    const where = mockOrder.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.id).toBe("order-1");
  });
});

// =============================================================================
// confirmOrder()
// =============================================================================
describe("confirmOrder()", () => {
  it("✅ berhasil konfirmasi order — status akhir confirmed", async () => {
    mockOrder.findFirst.mockResolvedValue(fakeOrder({ status: "pending_payment" }));
    mockOrder.update.mockResolvedValue(fakeOrder({ status: "confirmed" }));

    const result = await confirmOrder("user-1", "order-1");

    expect(result.message).toBe("Order dikonfirmasi.");

    // FIX [1]: Service sekarang 1x update langsung ke confirmed
    // (hapus double update processing → confirmed dari versi sebelumnya)
    expect(mockOrder.update).toHaveBeenCalledTimes(1);
    expect(mockOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data:  { status: "confirmed" },
      })
    );
  });

  it("✅ throw 404 jika order tidak ditemukan", async () => {
    mockOrder.findFirst.mockResolvedValue(null);

    await expect(confirmOrder("user-1", "ghost-order"))
      .rejects.toMatchObject({ status: 404 });
    expect(mockOrder.update).not.toHaveBeenCalled();
  });

  it("✅ throw 400 jika order bukan status pending_payment", async () => {
    mockOrder.findFirst.mockResolvedValue(fakeOrder({ status: "confirmed" }));

    await expect(confirmOrder("user-1", "order-1"))
      .rejects.toMatchObject({ status: 400 });
    expect(mockOrder.update).not.toHaveBeenCalled();
  });

  it("✅ hanya konfirmasi order milik user yang sedang login (cegah IDOR)", async () => {
    mockOrder.findFirst.mockResolvedValue(null);  // tidak ditemukan untuk user-lain

    await expect(confirmOrder("user-lain", "order-1"))
      .rejects.toMatchObject({ status: 404 });

    const where = mockOrder.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("user-lain");
  });
});