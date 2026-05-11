import { Prisma } from "@ecommerce/shared/generated/prisma";
import { prisma } from "../config/database";
import { AppError } from "../middlewares/error.middleware";

const cartSelect = {
    id: true,
    userId: true,
    status: true,
    items: {
        select: {
            id: true,
            productId: true,
            quantity: true,
            priceAtTime: true,
            product: {
                select: {
                    name: true,
                    images: true,
                    categoryId: true,
                    slug: true,
                    price: true,
                    stock: true,
                    discount: true,
                    description: true,
                }
            }
        }
    }
} satisfies Prisma.CartSelect;

const applyDiscount = (price: number, discount: number) =>
    discount > 0 ? price * (1 - discount / 100) : price;

// --- PRIVATE HELPERS ----------------------------------------------------------

// Lean read: hanya fetch cart id + status, no JOIN, no reconciliation.
// Dipanggil di awal setiap mutation sebagai pengganti getCartByUserId yang berat.
async function getActiveCartId(userId: string): Promise<string> {
    let cart = await prisma.cart.findUnique({
        where:  { userId },
        select: { id: true, status: true },
    });

    if (!cart) {
        // User belum punya cart sama sekali ? buat baru
        cart = await prisma.cart.create({
            data:   { userId, status: "active" },
            select: { id: true, status: true },
        });
    } else if (cart.status === "checked_out") {
        // FIX [Critical]: cart sudah ada tapi checked_out.
        // Jangan create() — Cart.userId punya @unique constraint, create() akan
        // throw P2002 unique constraint violation ? HTTP 500.
        // Cukup reaktivasi baris yang sudah ada dengan update().
        cart = await prisma.cart.update({
            where:  { userId },
            data:   { status: "active" },
            select: { id: true, status: true },
        });
    }

    return cart.id;
}

// Lean read setelah mutation — kembalikan cart fresh tanpa reconciliation.
// Safe karena mutation sendiri sudah validasi stock dan tulis priceAtTime yang benar.
async function fetchFreshCart(userId: string) {
    // FIX: hapus filter status: "active" — findUniqueOrThrow dengan userId saja
    // sudah cukup karena Cart.userId @unique. Filter status tambahan tidak perlu
    // dan bisa menyebabkan record not found kalau ada edge case status transition.
    return prisma.cart.findUniqueOrThrow({
        where:  { userId },
        select: cartSelect,
    });
}

// --- PUBLIC API ---------------------------------------------------------------

// GET endpoint: reconciliation dijalankan di sini, saat read.
// Lazy sync — tidak dijalankan di setiap write supaya write path tetap ringan.
export async function getCartByUserId(userId: string) {
    let cart = await prisma.cart.findUnique({
        where:  { userId },
        select: cartSelect,
    });

    // Belum punya cart ? buat baru
    if (!cart) {
        return await prisma.cart.create({
            data:   { userId, status: "active" },
            select: cartSelect,
        });
    }

    // FIX [Critical]: cart ada tapi checked_out.
    // Sebelumnya: prisma.cart.create() ? P2002 karena userId sudah ada (unique constraint).
    // Sekarang: prisma.cart.update() ? reaktivasi baris yang ada.
    // Ini juga lebih benar secara data model: satu user = satu cart yang bisa di-recycle.
    if (cart.status === "checked_out") {
        cart = await prisma.cart.update({
            where:  { userId },
            data:   { status: "active" },
            select: cartSelect,
        });
    }

    // Reconciliation: stock = 0 ? hapus item dari cart
    const outOfStockItems = cart.items.filter(item => item.product.stock === 0);
    if (outOfStockItems.length > 0) {
        cart = await prisma.cart.update({
            where: { id: cart.id },
            data: {
                items: {
                    deleteMany: { id: { in: outOfStockItems.map(item => item.id) } }
                }
            },
            select: cartSelect,
        });
    }

    // Reconciliation: stock < quantity ? cap ke stock yang ada
    const overQuantityItems = cart.items.filter(
        item => item.product.stock > 0 && item.product.stock < item.quantity
    );
    if (overQuantityItems.length > 0) {
        cart = await prisma.cart.update({
            where: { id: cart.id },
            data: {
                items: {
                    updateMany: overQuantityItems.map(item => ({
                        where: { id: item.id },
                        data:  { quantity: item.product.stock },
                    }))
                }
            },
            select: cartSelect,
        });
    }

    // Reconciliation: sync harga (termasuk kalkulasi diskon)
    const stalePriceItems = cart.items.filter(item => {
        const correctPrice = applyDiscount(
            Number(item.product.price),
            Number(item.product.discount ?? 0)
        );
        return Number(item.priceAtTime) !== correctPrice;
    });
    if (stalePriceItems.length > 0) {
        cart = await prisma.cart.update({
            where: { id: cart.id },
            data: {
                items: {
                    updateMany: stalePriceItems.map(item => ({
                        where: { id: item.id },
                        data: {
                            priceAtTime: applyDiscount(
                                Number(item.product.price),
                                Number(item.product.discount ?? 0)
                            ),
                        },
                    }))
                }
            },
            select: cartSelect,
        });
    }

    return cart;
}

export async function addItemToCart(userId: string, productId: string, quantity: number) {
    const cartId = await getActiveCartId(userId);   // 1 DB call (lean)

    const product = await prisma.product.findUnique({
        where:  { id: productId },
        select: { id: true, price: true, discount: true, stock: true },
    });
    if (!product) throw new AppError("Produk tidak ditemukan.", 404);

    // Pakai DB unique index cartId_productId, bukan load semua items ke memory
    const existingItem = await prisma.cartItem.findUnique({
        where:  { cartId_productId: { cartId, productId } },
        select: { id: true, quantity: true },
    });

    const totalQuantity = (existingItem?.quantity ?? 0) + quantity;
    if (product.stock < totalQuantity) throw new AppError("Stok tidak cukup.", 400);

    if (existingItem) {
        await prisma.cartItem.update({
            where: { id: existingItem.id },
            data:  { quantity: existingItem.quantity + quantity },
        });
    } else {
        await prisma.cartItem.create({
            data: {
                cartId,
                productId: product.id,
                quantity,
                priceAtTime: applyDiscount(
                    Number(product.price),
                    Number(product.discount ?? 0)
                ),
            },
        });
    }

    return fetchFreshCart(userId);  // 1 DB call (lean)
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
    const cartId = await getActiveCartId(userId);   // 1 DB call (lean)

    const item = await prisma.cartItem.findFirst({
        where:  { id: itemId, cartId },
        select: { id: true, productId: true },
    });
    if (!item) throw new AppError("Item tidak ditemukan di cart.", 404);

    // Auto remove kalau quantity 0
    if (quantity === 0) {
        await prisma.cartItem.delete({ where: { id: itemId } });
        return fetchFreshCart(userId);
    }

    const product = await prisma.product.findUnique({
        where:  { id: item.productId },
        select: { stock: true },
    });
    if (!product) throw new AppError("Produk tidak ditemukan.", 404);
    if (product.stock < quantity) throw new AppError("Stok tidak cukup.", 400);

    await prisma.cartItem.update({
        where: { id: itemId },
        data:  { quantity },
    });

    return fetchFreshCart(userId);  // 1 DB call (lean)
}

export async function removeCartItem(userId: string, itemId: string) {
    const cartId = await getActiveCartId(userId);   // 1 DB call (lean)

    const item = await prisma.cartItem.findFirst({
        where:  { id: itemId, cartId },
        select: { id: true },
    });
    if (!item) throw new AppError("Item tidak ditemukan di cart.", 404);

    await prisma.cartItem.delete({ where: { id: itemId } });

    return fetchFreshCart(userId);  // 1 DB call (lean)
}

export async function clearCart(userId: string) {
    const cartId = await getActiveCartId(userId);   // 1 DB call (lean)

    await prisma.cartItem.deleteMany({ where: { cartId } });

    return fetchFreshCart(userId);  // 1 DB call (lean)
}