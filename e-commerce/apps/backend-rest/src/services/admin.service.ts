import { OrderStatus } from "@ecommerce/shared/generated/prisma";
import { prisma } from "../config/database";
import { AppError } from "../middlewares/error.middleware";

// ============================================================
// ADMIN SERVICE
// Semua fungsi untuk modul admin (S-05: Admin Dashboard Flow)
// Query di sini berat (JOIN, agregasi) — relevan untuk riset performa
//
// FIX #3:  salesChart pakai $queryRaw + DATE_TRUNC('day') bukan groupBy createdAt.
//          groupBy createdAt (exact timestamp) = tiap order 1 bucket sendiri ? N rows.
//          DATE_TRUNC('day') = 1 bucket per hari ? max 30 rows. Benar secara semantik.
// FIX #7:  updateProduct + deleteProduct: hapus extra findUnique sebelum update.
//          Error "not found" sudah ditangani oleh errorMiddleware via Prisma P2025.
// FIX #9:  recentOrders.total + topProducts.price: normalize Prisma Decimal ? Number.
// ============================================================

// -- getDashboardStats -----------------------------------------
export async function getDashboardStats() {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalOrdersToday,
    weeklyRevenue,
    totalOrders,
    totalProducts,
    totalUsers,
    topProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status:    { not: "cancelled" },
      },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.product.findMany({
      where:   { isActive: true },
      select:  {
        id:        true,
        name:      true,
        slug:      true,
        price:     true,
        stock:     true,
        soldCount: true,
        images:    true,
        category:  { select: { name: true } },
      },
      orderBy: { soldCount: "desc" },
      take:    10,
    }),
    prisma.order.findMany({
      select: {
        id:          true,
        orderNumber: true,
        status:      true,
        total:       true,
        createdAt:   true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    10,
    }),
  ]);

  // FIX #3: $queryRaw + DATE_TRUNC('day') — bukan groupBy createdAt.
  // groupBy: ["createdAt"] group by exact timestamp (millisecond precision) ?
  // setiap order dapat bucket sendiri ? N rows untuk N orders (bisa ribuan).
  // DATE_TRUNC('day', created_at) group by hari ? max 30 rows untuk 30 hari.
  //
  // Column mapping dari schema.prisma:
  //   Order.createdAt ? created_at
  //   Order.total     ? total
  //   Order.status    ? status
  //   Order table     ? orders
  //
  // COUNT(*) dan SUM() return BigInt dari PostgreSQL — dikonversi ke number via Number().
  type SalesRow = { date: Date; revenue: unknown; orders: unknown };
  const salesChart = await prisma.$queryRaw<SalesRow[]>`
    SELECT
      DATE_TRUNC('day', created_at)   AS date,
      COALESCE(SUM(total), 0)::float8 AS revenue,
      COUNT(*)::int                   AS orders
    FROM   orders
    WHERE  created_at >= ${thirtyDaysAgo}
      AND  status != 'cancelled'
    GROUP  BY DATE_TRUNC('day', created_at)
    ORDER  BY DATE_TRUNC('day', created_at) ASC
  `;

  return {
    summary: {
      totalOrdersToday,
      weeklyRevenue: Number(weeklyRevenue._sum.total ?? 0),
      totalOrders,
      totalProducts,
      totalUsers,
    },
    // FIX #9: topProducts.price adalah Prisma Decimal ? serialize ke string tanpa Number().
    topProducts: topProducts.map(p => ({
      ...p,
      price: Number(p.price),
    })),
    // FIX #9: recentOrders.total adalah Prisma Decimal ? serialize ke string tanpa Number().
    recentOrders: recentOrders.map(o => ({
      ...o,
      total: Number(o.total),
    })),
    // FIX #3: Number() karena BigInt dari PostgreSQL tidak bisa JSON.stringify langsung.
    salesChart: salesChart.map(row => ({
      date:    row.date,
      revenue: Number(row.revenue),
      orders:  Number(row.orders),
    })),
  };
}

// -- getAllProducts ---------------------------------------------
export async function getAllProducts(query: {
  page?:       number;
  limit?:      number;
  q?:          string;
  categoryId?: string;
  isActive?:   boolean;
}) {
  const { page = 1, limit = 20, q, categoryId, isActive } = query;

  const where = {
    ...(q          && { name: { contains: q, mode: "insensitive" as const } }),
    ...(categoryId && { categoryId }),
    ...(isActive !== undefined && { isActive }),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id:        true,
        name:      true,
        slug:      true,
        price:     true,
        stock:     true,
        soldCount: true,
        isActive:  true,
        discount:  true,
        images:    true,
        createdAt: true,
        category:  { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return {
    data:        products,
    totalCount:  total,
    page,
    totalPages:  Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };
}

// -- createProduct ---------------------------------------------
export async function createProduct(data: {
  categoryId:   string;
  name:         string;
  description?: string;
  price:        number;
  stock:        number;
  images?:      string[];
  discount?:    number;
}) {
  const slug =
    data.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 200)
      .trim() +
    "-" +
    Date.now();

  return prisma.product.create({
    data:   { ...data, slug, images: data.images ?? [] },
    select: {
      id: true, name: true, slug: true, price: true,
      stock: true, isActive: true, createdAt: true,
    },
  });
}

// -- updateProduct ---------------------------------------------
// FIX #7: hapus findUnique sebelum update.
// Sebelumnya: findUnique ? jika null throw AppError ? update.
// Sesudahnya:  update langsung ? Prisma throw P2025 jika tidak ada ?
//              errorMiddleware sudah handle P2025 ? HTTP 404.
// Hemat 1 DB roundtrip per call. Behavior dari sisi client sama persis.
export async function updateProduct(
  id:   string,
  data: Partial<{
    name:        string;
    description: string;
    price:       number;
    stock:       number;
    images:      string[];
    discount:    number;
    isActive:    boolean;
    categoryId:  string;
  }>
) {
  try {
    return await prisma.product.update({
      where:  { id },
      data,
      select: {
        id: true, name: true, price: true, stock: true,
        isActive: true, updatedAt: true,
      },
    });
  } catch (err: any) {
    // P2025 = "Record to update not found" — re-throw sebagai AppError
    // supaya errorMiddleware return 404 dengan pesan yang jelas.
    if (err?.code === "P2025") throw new AppError("Produk tidak ditemukan.", 404);
    throw err;
  }
}

// -- deleteProduct ---------------------------------------------
// Soft delete — set isActive = false
// FIX #7: hapus findUnique sebelum update (alasan sama dengan updateProduct).
export async function deleteProduct(id: string) {
  try {
    await prisma.product.update({
      where: { id },
      data:  { isActive: false },
    });
    return { message: "Produk dinonaktifkan." };
  } catch (err: any) {
    if (err?.code === "P2025") throw new AppError("Produk tidak ditemukan.", 404);
    throw err;
  }
}

// -- getAllOrders ----------------------------------------------
export async function getAllOrders(query: {
  page?:   number;
  limit?:  number;
  status?: OrderStatus;
  q?:      string;
}) {
  const { page = 1, limit = 20, status, q } = query;

  const where = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" as const } },
        { user: { email: { contains: q, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id:             true,
        orderNumber:    true,
        status:         true,
        total:          true,
        createdAt:      true,
        paymentMethod:  true,
        shippingMethod: true,
        user:  { select: { id: true, name: true, email: true } },
        items: { select: { id: true, productName: true, quantity: true, unitPrice: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return {
    data:        orders,
    totalCount:  total,
    page,
    totalPages:  Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };
}

// -- updateOrderStatus -----------------------------------------
// findUnique di sini DIPERTAHANKAN — diperlukan untuk validasi state machine
// (cek status saat ini sebelum memutuskan transisi yang valid).
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError("Order tidak ditemukan.", 404);

  const validTransitions: Record<string, OrderStatus[]> = {
    pending_payment: ["confirmed", "cancelled"],
    confirmed:       ["processing"],
    processing:      ["shipped"],
    shipped:         ["delivered"],
    delivered:       [],
    cancelled:       [],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw new AppError(
      `Tidak bisa mengubah status dari ${order.status} ke ${status}.`,
      400
    );
  }

  return prisma.order.update({
    where:  { id: orderId },
    data:   { status },
    select: { id: true, orderNumber: true, status: true, updatedAt: true },
  });
}

// -- getAllUsers -----------------------------------------------
export async function getAllUsers(query: {
  page?:  number;
  limit?: number;
  q?:     string;
}) {
  const { page = 1, limit = 20, q } = query;

  const where = q
    ? {
        OR: [
          { name:  { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        phone:     true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return {
    data:        users,
    totalCount:  total,
    page,
    totalPages:  Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };
}