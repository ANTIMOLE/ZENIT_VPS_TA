/**
 * cart.service.test.ts — Whitebox Unit Test
 * File ini SAMA untuk REST dan tRPC (service identik).
 * Sesuaikan import path jika perlu:
 *   REST : backend-rest/src/__tests__/unit/cart.service.test.ts
 *   tRPC : backend-trpc/src/__tests__/unit/cart.service.test.ts
 *
 * FIX v2:
 *  [1] Tambah 3 method mock yang sebelumnya tidak ada:
 *        cart.findUniqueOrThrow  ← dipanggil oleh fetchFreshCart() setelah setiap mutation
 *        cartItem.findUnique     ← dipanggil oleh addItemToCart() untuk cek item existing
 *        cartItem.findFirst      ← dipanggil oleh updateCartItem() dan removeCartItem()
 *  [2] getCartByUserId checked_out test:
 *        Sebelumnya expect CREATE (cart baru), sekarang expect UPDATE (reaktivasi).
 *        Fix P2002 bug: Cart.userId @unique → create() throw conflict, harus update().
 *  [3] Setiap mutation test — tambah mock setup untuk 3 method baru di atas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    cart: {
      findUnique:        vi.fn(),
      findUniqueOrThrow: vi.fn(),   // FIX [1]: fetchFreshCart() pakai ini
      create:            vi.fn(),
      update:            vi.fn(),
    },
    cartItem: {
      findUnique:  vi.fn(),   // FIX [1]: addItemToCart() pakai compound unique
      findFirst:   vi.fn(),   // FIX [1]: updateCartItem() dan removeCartItem()
      create:      vi.fn(),
      update:      vi.fn(),
      delete:      vi.fn(),
      deleteMany:  vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma } from "../../config/database";
import {
  getCartByUserId,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../../services/cart.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockCart     = prisma.cart     as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockCartItem = prisma.cartItem as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockProduct  = prisma.product  as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const makeProduct = (overrides = {}) => ({
  id: "prod-1", name: "Sepatu Running", slug: "sepatu-running",
  price: 100_000, discount: 0, stock: 10,
  images: ["img.jpg"], categoryId: "cat-1",
  description: "Deskripsi", ...overrides,
});

const makeItem = (overrides = {}) => ({
  id: "item-1", productId: "prod-1", quantity: 2,
  priceAtTime: 100_000, product: makeProduct(),
  ...overrides,
});

const makeCart = (overrides = {}) => ({
  id: "cart-1", userId: "user-1", status: "active",
  items: [], ...overrides,
});

// =============================================================================
// getCartByUserId()
// =============================================================================
describe("getCartByUserId()", () => {
  it("✅ return cart aktif yang sudah ada", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    const result = await getCartByUserId("user-1");
    expect(result.id).toBe("cart-1");
    expect(mockCart.create).not.toHaveBeenCalled();
    expect(mockCart.update).not.toHaveBeenCalled();
  });

  it("✅ buat cart baru jika user belum punya cart", async () => {
    mockCart.findUnique.mockResolvedValue(null);
    mockCart.create.mockResolvedValue(makeCart());
    await getCartByUserId("user-1");
    expect(mockCart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: "user-1", status: "active" } })
    );
  });

  it("✅ reaktivasi cart via update() jika status checked_out — BUKAN create()", async () => {
    // FIX [2]: Service pakai update() untuk reaktivasi cart checked_out.
    // Alasan: Cart.userId punya constraint @unique → create() baru akan throw P2002.
    // update() mengubah status baris yang sudah ada → aman.
    const checkedOutCart = makeCart({ status: "checked_out" });
    const reactivatedCart = makeCart({ id: "cart-1", status: "active" });
    mockCart.findUnique.mockResolvedValue(checkedOutCart);
    mockCart.update.mockResolvedValue(reactivatedCart);

    const result = await getCartByUserId("user-1");

    // Harus UPDATE, bukan CREATE
    expect(mockCart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data:  { status: "active" },
      })
    );
    expect(result.id).toBe("cart-1");
    // create() TIDAK boleh dipanggil
    expect(mockCart.create).not.toHaveBeenCalled();
  });

  it("✅ hapus item dengan stock 0 dari cart (reconciliation)", async () => {
    const outOfStockItem = makeItem({ product: makeProduct({ stock: 0 }) });
    mockCart.findUnique.mockResolvedValue(makeCart({ items: [outOfStockItem] }));
    mockCart.update.mockResolvedValue(makeCart({ items: [] }));

    await getCartByUserId("user-1");

    expect(mockCart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({ deleteMany: expect.any(Object) }),
        }),
      })
    );
  });

  it("✅ cap quantity ke stock yang tersisa jika stock < quantity (reconciliation)", async () => {
    const overQuantityItem = makeItem({ quantity: 10, product: makeProduct({ stock: 3 }) });
    mockCart.findUnique.mockResolvedValue(makeCart({ items: [overQuantityItem] }));
    mockCart.update.mockResolvedValue(makeCart({ items: [makeItem({ quantity: 3 })] }));

    await getCartByUserId("user-1");

    expect(mockCart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({ updateMany: expect.any(Array) }),
        }),
      })
    );
  });

  it("✅ sync priceAtTime jika harga produk berubah (reconciliation)", async () => {
    // Item punya priceAtTime 100_000, tapi harga produk sekarang 80_000
    const stalePriceItem = makeItem({
      priceAtTime: 100_000, product: makeProduct({ price: 80_000, discount: 0 }),
    });
    mockCart.findUnique.mockResolvedValue(makeCart({ items: [stalePriceItem] }));
    mockCart.update.mockResolvedValue(makeCart({ items: [makeItem({ priceAtTime: 80_000 })] }));

    await getCartByUserId("user-1");

    expect(mockCart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({ updateMany: expect.any(Array) }),
        }),
      })
    );
  });
});

// =============================================================================
// addItemToCart()
// =============================================================================
describe("addItemToCart()", () => {
  it("✅ tambah item baru ke cart", async () => {
    // FIX [1]+[3]: getActiveCartId → findUnique, lalu cartItem.findUnique untuk cek existing
    mockCart.findUnique.mockResolvedValue(makeCart());                    // getActiveCartId
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 10 }));
    mockCartItem.findUnique.mockResolvedValue(null);                      // FIX [1]: tidak ada item existing
    mockCartItem.create.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] })); // FIX [1]: fetchFreshCart

    await addItemToCart("user-1", "prod-1", 1);

    expect(mockCartItem.create).toHaveBeenCalledOnce();
    expect(mockCart.findUniqueOrThrow).toHaveBeenCalledOnce();
  });

  it("✅ update quantity jika produk sudah ada di cart", async () => {
    const existingItem = { id: "item-1", quantity: 2 };
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 10 }));
    mockCartItem.findUnique.mockResolvedValue(existingItem);               // FIX [1]: item sudah ada
    mockCartItem.update.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(                          // FIX [1]: fetchFreshCart
      makeCart({ items: [makeItem({ quantity: 5 })] })
    );

    await addItemToCart("user-1", "prod-1", 3);

    // Harus update bukan create (quantity lama 2 + baru 3 = 5)
    expect(mockCartItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: 5 } })
    );
    expect(mockCartItem.create).not.toHaveBeenCalled();
  });

  it("✅ throw 404 jika produk tidak ditemukan", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(null);

    await expect(addItemToCart("user-1", "ghost", 1))
      .rejects.toMatchObject({ status: 404 });
    expect(mockCartItem.create).not.toHaveBeenCalled();
  });

  it("✅ throw 400 jika quantity melebihi stok", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 2 }));
    mockCartItem.findUnique.mockResolvedValue(null);                      // FIX [1]: tidak ada item existing

    // stock 2 < quantity 10 → throw 400
    await expect(addItemToCart("user-1", "prod-1", 10))
      .rejects.toMatchObject({ status: 400, message: "Stok tidak cukup." });
  });

  it("✅ throw 400 jika total quantity (existing + baru) melebihi stok", async () => {
    // Item sudah ada quantity 8, tambah 5, tapi stock hanya 10
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 10 }));
    mockCartItem.findUnique.mockResolvedValue({ id: "item-1", quantity: 8 }); // FIX [1]: existing

    // totalQuantity = 8 + 5 = 13 > stock 10
    await expect(addItemToCart("user-1", "prod-1", 5))
      .rejects.toMatchObject({ status: 400 });
  });

  it("✅ priceAtTime dihitung dengan diskon (applyDiscount)", async () => {
    // price: 100_000, discount: 10% → priceAtTime: 90_000
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(makeProduct({ price: 100_000, discount: 10 }));
    mockCartItem.findUnique.mockResolvedValue(null);                         // FIX [1]
    mockCartItem.create.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart());                // FIX [1]

    await addItemToCart("user-1", "prod-1", 1);

    const createArg = mockCartItem.create.mock.calls[0][0];
    expect(createArg.data.priceAtTime).toBe(90_000);
  });

  it("✅ priceAtTime = harga asli jika tidak ada diskon", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockProduct.findUnique.mockResolvedValue(makeProduct({ price: 150_000, discount: 0 }));
    mockCartItem.findUnique.mockResolvedValue(null);                         // FIX [1]
    mockCartItem.create.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart());                // FIX [1]

    await addItemToCart("user-1", "prod-1", 1);

    const createArg = mockCartItem.create.mock.calls[0][0];
    expect(createArg.data.priceAtTime).toBe(150_000);
  });
});

// =============================================================================
// updateCartItem()
// =============================================================================
describe("updateCartItem()", () => {
  it("✅ update quantity item", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());                       // getActiveCartId
    mockCartItem.findFirst.mockResolvedValue(                               // FIX [1]: ownership check
      { id: "item-1", productId: "prod-1" }
    );
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 10 }));
    mockCartItem.update.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(                           // FIX [1]: fetchFreshCart
      makeCart({ items: [makeItem({ quantity: 5 })] })
    );

    await updateCartItem("user-1", "item-1", 5);

    expect(mockCartItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1" }, data: { quantity: 5 } })
    );
  });

  it("✅ hapus item jika quantity = 0 (auto remove)", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockCartItem.findFirst.mockResolvedValue({ id: "item-1", productId: "prod-1" }); // FIX [1]
    mockCartItem.delete.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] }));   // FIX [1]

    await updateCartItem("user-1", "item-1", 0);

    expect(mockCartItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
    expect(mockCartItem.update).not.toHaveBeenCalled();
  });

  it("✅ throw 404 jika item tidak ada di cart user ini", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockCartItem.findFirst.mockResolvedValue(null);   // FIX [1]: item tidak ditemukan

    await expect(updateCartItem("user-1", "item-ghost", 2))
      .rejects.toMatchObject({ status: 404 });
    expect(mockCartItem.update).not.toHaveBeenCalled();
  });

  it("✅ throw 400 jika stok tidak cukup", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockCartItem.findFirst.mockResolvedValue({ id: "item-1", productId: "prod-1" }); // FIX [1]
    mockProduct.findUnique.mockResolvedValue(makeProduct({ stock: 2 }));

    await expect(updateCartItem("user-1", "item-1", 10))
      .rejects.toMatchObject({ status: 400 });
  });
});

// =============================================================================
// removeCartItem()
// =============================================================================
describe("removeCartItem()", () => {
  it("✅ hapus item dari cart", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());                         // getActiveCartId
    mockCartItem.findFirst.mockResolvedValue({ id: "item-1" });               // FIX [1]: ownership check
    mockCartItem.delete.mockResolvedValue({});
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] }));    // FIX [1]: fetchFreshCart

    await removeCartItem("user-1", "item-1");

    expect(mockCartItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });

  it("✅ throw 404 jika item tidak ditemukan di cart user ini", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());
    mockCartItem.findFirst.mockResolvedValue(null);   // FIX [1]: tidak ditemukan

    await expect(removeCartItem("user-1", "ghost-item"))
      .rejects.toMatchObject({ status: 404 });
    expect(mockCartItem.delete).not.toHaveBeenCalled();
  });
});

// =============================================================================
// clearCart()
// =============================================================================
describe("clearCart()", () => {
  it("✅ hapus semua item dari cart via deleteMany", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart());                        // getActiveCartId
    mockCartItem.deleteMany.mockResolvedValue({ count: 3 });
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] }));   // FIX [1]: fetchFreshCart

    await clearCart("user-1");

    expect(mockCartItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cartId: "cart-1" } })
    );
  });

  it("✅ tidak error jika cart sudah kosong — deleteMany tetap dipanggil", async () => {
    mockCart.findUnique.mockResolvedValue(makeCart({ items: [] }));
    mockCartItem.deleteMany.mockResolvedValue({ count: 0 });
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] }));   // FIX [1]

    await expect(clearCart("user-1")).resolves.not.toThrow();
    expect(mockCartItem.deleteMany).toHaveBeenCalledOnce();
  });

  it("✅ reaktivasi cart checked_out sebelum clear (getActiveCartId logic)", async () => {
    // Kalau cart status checked_out, getActiveCartId reaktivasi dulu via update()
    mockCart.findUnique.mockResolvedValue(makeCart({ status: "checked_out" }));
    mockCart.update.mockResolvedValue(makeCart({ status: "active" }));        // reaktivasi
    mockCartItem.deleteMany.mockResolvedValue({ count: 0 });
    mockCart.findUniqueOrThrow.mockResolvedValue(makeCart({ items: [] }));   // FIX [1]

    await clearCart("user-1");

    // Pertama: update reaktivasi
    expect(mockCart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "active" } })
    );
    // Kedua: deleteMany
    expect(mockCartItem.deleteMany).toHaveBeenCalledOnce();
  });
});