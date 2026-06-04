/**
 * checkout.service.test.ts — Whitebox Unit Test (backend-trpc ONLY)
 * Letakkan di: backend-trpc/src/__tests__/unit/checkout.service.test.ts
 *
 * FIX v2 (tRPC-specific):
 *  [1] tRPC checkout.service.ts melempar TRPCError, BUKAN AppError.
 *      TRPCError punya { code: "NOT_FOUND" }, TIDAK punya { status: 404 }.
 *      Semua error assertion harus pakai .code bukan .status.
 *      REST service memakai AppError (punya .status) → REST checkout test BERBEDA.
 *
 *      Mapping:
 *        { status: 404 }  →  { code: "NOT_FOUND"   }
 *        { status: 400 }  →  { code: "BAD_REQUEST"  }
 *
 *  [2] calculateCheckoutSummary sekarang 3 argumen (userId, cartId, shippingMethod)
 *  [3] Tax 11% (bukan 10%), express 35.000 (bukan 25.000)
 *  [4] $transaction mock mengeksekusi CALLBACK, bukan return value statis
 *  [5] getCheckoutSummary fixture sudah aman — service pakai (items ?? []).map(...)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError }                             from "@trpc/server";

// ─── MOCK ────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    order:    { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    cart:     { findUnique: vi.fn(), update: vi.fn() },
    address:  { findUnique: vi.fn() },
    product:  { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

vi.mock("@ecommerce/shared/generated/prisma", () => ({
  PaymentMethod:  { bank_transfer: "bank_transfer", e_wallet: "e_wallet", cod: "cod" },
  ShippingMethod: { regular: "regular", express: "express" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma } from "../../config/database";
import {
  getCheckoutSummary,
  calculateCheckoutSummary,
  confirmCheckout,
} from "../../services/checkout.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockOrder   = prisma.order   as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockCart    = prisma.cart    as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockAddress = prisma.address as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockPrisma  = prisma         as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ─── Tx-level mocks ───────────────────────────────────────────────────────────
const txCartFU  = vi.fn();  // tx.cart.findUnique
const txCartU   = vi.fn();  // tx.cart.update
const txProdFM  = vi.fn();  // tx.product.findMany
const txProdU   = vi.fn();  // tx.product.update (sequential, sorted by productId)
const txOrdC    = vi.fn();  // tx.order.create
const txCIDelM  = vi.fn();  // tx.cartItem.deleteMany

beforeEach(() => {
  vi.clearAllMocks();
  // Re-setup $transaction callback executor setelah clearAllMocks
  mockPrisma.$transaction.mockImplementation(async (cb: Function) =>
    cb({
      cart:     { findUnique: txCartFU, update: txCartU },
      product:  { findMany: txProdFM,   update: txProdU },
      order:    { create: txOrdC },
      cartItem: { deleteMany: txCIDelM },
    })
  );
});

// ─── Fixtures ──────────────────────────────────────────────────────────────────
const USER_ID    = "user-1";
const CART_ID    = "cart-1";
const ADDRESS_ID = "addr-1";

const fakeAddress = {
  id: ADDRESS_ID, userId: USER_ID,
  recipientName: "Budi", phone: "08123456789",
  address: "Jl. Test No 1", city: "Jakarta",
  province: "DKI Jakarta", zipCode: "10110",
};

// fakeCartWithItems: item harus punya nilai angka untuk Number() calculation
const fakeCartWithItems = {
  id: CART_ID, userId: USER_ID,
  items: [
    { productId: "prod-1", quantity: 2, priceAtTime: 100_000 },  // 200.000
    { productId: "prod-2", quantity: 1, priceAtTime: 200_000 },  // 200.000
  ],
  // subtotal total = 400.000
};

// =============================================================================
// getCheckoutSummary()
// =============================================================================
describe("getCheckoutSummary()", () => {
  // FIX [5]: fakeCheckout tidak perlu items karena service pakai (checkout.items ?? []).map(...)
  // undefined ?? [] = [] → .map() aman. Fixture minimal sudah cukup.
  const fakeCheckout = {
    orderNumber:  "ORD-123",
    status:       "pending_payment",
    total:        450_000,
    subtotal:     400_000,
    tax:          44_000,
    shippingCost: 15_000,
    items:        [],   // ← aman walaupun tidak ada, tapi explicit lebih jelas
  };

  it("✅ return detail order berdasarkan orderNumber + userId", async () => {
    mockOrder.findFirst.mockResolvedValue(fakeCheckout);

    const result = await getCheckoutSummary(USER_ID, "ORD-123");

    expect(result.orderNumber).toBe("ORD-123");
    expect(mockOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "ORD-123", userId: USER_ID } })
    );
  });

  it("✅ throw NOT_FOUND jika orderNumber tidak ditemukan", async () => {
    // FIX [1]: service melempar TRPCError { code: "NOT_FOUND" }, BUKAN AppError { status: 404 }
    mockOrder.findFirst.mockResolvedValue(null);

    await expect(getCheckoutSummary(USER_ID, "ORD-GHOST"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("✅ error adalah instance TRPCError (bukan AppError)", async () => {
    mockOrder.findFirst.mockResolvedValue(null);
    await expect(getCheckoutSummary(USER_ID, "ORD-GHOST"))
      .rejects.toBeInstanceOf(TRPCError);
  });
});

// =============================================================================
// calculateCheckoutSummary()
// =============================================================================
describe("calculateCheckoutSummary()", () => {
  it("✅ hitung subtotal, tax 11%, dan shipping regular (15.000)", async () => {
    // subtotal = 2×100k + 1×200k = 400.000
    // tax      = 400.000 × 0.11 = 44.000
    // shipping = 15.000 (regular)
    // total    = 459.000
    mockCart.findUnique.mockResolvedValue(fakeCartWithItems);

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "regular");

    expect(result.subtotal).toBe(400_000);
    expect(result.tax).toBe(44_000);           // 11%, BUKAN 40.000 (10%)
    expect(result.shippingCost).toBe(15_000);
    expect(result.total).toBe(459_000);
  });

  it("✅ tax 11% — bukan 10%", async () => {
    mockCart.findUnique.mockResolvedValue({
      userId: USER_ID,
      items: [{ quantity: 1, priceAtTime: 100_000 }],
    });

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "regular");

    expect(result.tax).toBe(11_000);  // FIX: 11%, bukan 10.000
  });

  it("✅ express shipping = 35.000 (bukan 25.000)", async () => {
    mockCart.findUnique.mockResolvedValue(fakeCartWithItems);

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "express");

    expect(result.shippingCost).toBe(35_000);  // FIX: 35k, bukan 25k
  });

  it("✅ total express dengan 1 item 100k: 100k + 11k + 35k = 146k", async () => {
    mockCart.findUnique.mockResolvedValue({
      userId: USER_ID,
      items: [{ quantity: 1, priceAtTime: 100_000 }],
    });

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "express");

    expect(result.total).toBe(146_000);
  });

  it("✅ subtotal 0 jika cart kosong — total hanya ongkir", async () => {
    mockCart.findUnique.mockResolvedValue({ id: CART_ID, userId: USER_ID, items: [] });

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "regular");

    expect(result.subtotal).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(15_000);
  });

  it("✅ invariant: total = subtotal + tax + shippingCost selalu berlaku", async () => {
    mockCart.findUnique.mockResolvedValue(fakeCartWithItems);

    const result = await calculateCheckoutSummary(USER_ID, CART_ID, "express");

    expect(result.total).toBe(result.subtotal + result.tax + result.shippingCost);
  });

  it("✅ throw NOT_FOUND jika cart tidak ditemukan", async () => {
    // FIX [1]: TRPCError { code: "NOT_FOUND" }, bukan AppError { status: 404 }
    mockCart.findUnique.mockResolvedValue(null);

    await expect(calculateCheckoutSummary(USER_ID, CART_ID, "regular"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("✅ throw NOT_FOUND jika cart bukan milik userId (ownership check)", async () => {
    // FIX [1]: TRPCError, bukan AppError
    mockCart.findUnique.mockResolvedValue({ ...fakeCartWithItems, userId: "other-user" });

    await expect(calculateCheckoutSummary(USER_ID, CART_ID, "regular"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("✅ error adalah instance TRPCError — bukan AppError", async () => {
    mockCart.findUnique.mockResolvedValue(null);
    await expect(calculateCheckoutSummary(USER_ID, CART_ID, "regular"))
      .rejects.toBeInstanceOf(TRPCError);
  });
});

// =============================================================================
// confirmCheckout()
// =============================================================================
describe("confirmCheckout()", () => {
  const fakeOrderResult = {
    id: "order-1", orderNumber: "ORD-123", total: 459_000, items: [],
  };

  function setupHappyPath() {
    mockAddress.findUnique.mockResolvedValue(fakeAddress);
    txCartFU.mockResolvedValue(fakeCartWithItems);
    txProdFM.mockResolvedValue([
      { id: "prod-1", stock: 10, name: "Produk A" },
      { id: "prod-2", stock: 5,  name: "Produk B" },
    ]);
    txOrdC.mockResolvedValue(fakeOrderResult);
    txProdU.mockResolvedValue({});
    txCIDelM.mockResolvedValue({ count: 1 });
    txCartU.mockResolvedValue({});
  }

  it("✅ berhasil buat order — $transaction dieksekusi sebagai callback", async () => {
    setupHappyPath();

    const result = await confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular");

    expect(result.id).toBe("order-1");
    // address dicek sebelum tx
    expect(mockAddress.findUnique).toHaveBeenCalledWith({ where: { id: ADDRESS_ID } });
    // tx harus dipanggil sebagai callback
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    // order dibuat di dalam tx
    expect(txOrdC).toHaveBeenCalledOnce();
    // stok dikurangi (sequential, sorted by productId)
    expect(txProdU).toHaveBeenCalled();
    // cart items dibersihkan di dalam tx
    expect(txCIDelM).toHaveBeenCalledWith({ where: { cartId: CART_ID } });
  });

  it("✅ throw NOT_FOUND jika address tidak ditemukan", async () => {
    // FIX [1]: TRPCError { code: "NOT_FOUND" }
    mockAddress.findUnique.mockResolvedValue(null);

    await expect(confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    // tx tidak boleh dipanggil kalau address gagal
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("✅ throw NOT_FOUND jika address milik user lain (ownership check)", async () => {
    // FIX [1]: TRPCError { code: "NOT_FOUND" }
    mockAddress.findUnique.mockResolvedValue({ ...fakeAddress, userId: "other-user" });

    await expect(confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("✅ throw BAD_REQUEST jika cart kosong (dicek di dalam tx)", async () => {
    // FIX [1]: TRPCError { code: "BAD_REQUEST" }
    mockAddress.findUnique.mockResolvedValue(fakeAddress);
    txCartFU.mockResolvedValue({ id: CART_ID, userId: USER_ID, items: [] });

    await expect(confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular"))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(txOrdC).not.toHaveBeenCalled();
  });

  it("✅ throw NOT_FOUND jika cart di dalam tx bukan milik userId", async () => {
    // FIX [1]: TRPCError { code: "NOT_FOUND" }
    mockAddress.findUnique.mockResolvedValue(fakeAddress);
    txCartFU.mockResolvedValue({
      userId: "other-user",
      items: [{ productId: "p", quantity: 1, priceAtTime: 1000 }],
    });

    await expect(confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(txOrdC).not.toHaveBeenCalled();
  });

  it("✅ throw BAD_REQUEST jika stok prod-1 tidak cukup (butuh 2, ada 1)", async () => {
    // FIX [1]: TRPCError { code: "BAD_REQUEST" }
    mockAddress.findUnique.mockResolvedValue(fakeAddress);
    txCartFU.mockResolvedValue(fakeCartWithItems);
    txProdFM.mockResolvedValue([
      { id: "prod-1", stock: 1, name: "Produk A" },  // butuh 2, ada 1
      { id: "prod-2", stock: 5, name: "Produk B" },
    ]);

    await expect(confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular"))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(txOrdC).not.toHaveBeenCalled();
  });

  it("✅ throw jika paymentMethod tidak valid (sebelum address check)", async () => {
    // Enum validation — service melempar sebelum panggil address.findUnique
    await expect(
      confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "BITCOIN", "regular")
    ).rejects.toThrow();

    expect(mockAddress.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("✅ throw jika shippingMethod tidak valid", async () => {
    await expect(
      confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "TELEPORT")
    ).rejects.toThrow();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("✅ tax 11% dan express 35k dihitung benar di dalam tx", async () => {
    setupHappyPath();
    // Capture data yang dikirim ke order.create
    txOrdC.mockImplementation(async ({ data }: any) => ({
      id: "order-1", orderNumber: "ORD-TEST", ...data, items: [],
    }));

    await confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "express");

    const createData = txOrdC.mock.calls[0][0].data;
    // subtotal = 2×100k + 1×200k = 400.000
    expect(Number(createData.subtotal)).toBe(400_000);
    expect(Number(createData.tax)).toBeCloseTo(44_000, 0);  // 11%
    expect(Number(createData.shippingCost)).toBe(35_000);   // express
    expect(Number(createData.total)).toBeCloseTo(479_000, 0);
  });

  it("✅ error adalah instance TRPCError — bukan AppError", async () => {
    mockAddress.findUnique.mockResolvedValue(null);
    await expect(
      confirmCheckout(USER_ID, CART_ID, ADDRESS_ID, "bank_transfer", "regular")
    ).rejects.toBeInstanceOf(TRPCError);
  });
});