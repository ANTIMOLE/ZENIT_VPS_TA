import { prisma } from "../config/database";
import { AppError } from "../middlewares/error.middleware";
import { OrderStatus } from "@ecommerce/shared/generated/prisma";

// ============================================================
// ORDER SERVICE
//
// FIX #5: getOrders() — count + findMany sekarang concurrent via Promise.all.
//         Sebelumnya sequential (await count lalu await findMany) ? 2 RTT ke DB.
//         Read-only query, tidak ada write ? aman diparalelkan.
//
// FIX #6: confirmOrder() — hapus double UPDATE (processing ? confirmed).
//         setTimeout sudah di-comment, tapi 2 prisma.order.update() tetap ada
//         ? 2 RTT untuk hasil yang sama. Update langsung ke "confirmed" dalam 1 call.
// ============================================================

// -- getOrders -------------------------------------------------
export async function getOrders(userId: string, query: any) {
  const page   = Number(query.page  ?? 1);
  const limit  = Number(query.limit ?? 20);
  const status = query.status as OrderStatus | undefined;

  const where = {
    userId,
    ...(status && { status }),
  };

  // FIX #5: Promise.all — count dan findMany jalan concurrent, bukan sequential.
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip:    (page - 1) * limit,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select:  {
        id:          true,
        orderNumber: true,
        status:      true,
        total:       true,
        createdAt:   true,
        items: {
          select: {
            id:          true,
            productId:   true,
            productName: true,
            quantity:    true,
            unitPrice:   true,
            subtotal:    true,
            product: {
              select: {
                slug:   true,
                images: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Normalize Prisma Decimal ke number
  const normalized = orders.map((order) => ({
    ...order,
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      subtotal:  Number(item.subtotal),
    })),
  }));

  return { orders: normalized, total };
}

// -- getOrderById ----------------------------------------------
export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where:  { id: orderId, userId },
    select: {
      id:              true,
      orderNumber:     true,
      status:          true,
      subtotal:        true,
      tax:             true,
      shippingCost:    true,
      total:           true,
      shippingAddress: true,
      paymentMethod:   true,
      shippingMethod:  true,
      createdAt:       true,
      updatedAt:       true,
      items: {
        select: {
          id:           true,
          productId:    true,
          productName:  true,
          productImage: true,
          quantity:     true,
          unitPrice:    true,
          subtotal:     true,
          product: {
            select: {
              slug:   true,
              images: true,
            },
          },
        },
      },
    },
  });

  if (!order) throw new AppError("Order tidak ditemukan.", 404);

  return {
    ...order,
    subtotal:     Number(order.subtotal),
    tax:          Number(order.tax),
    shippingCost: Number(order.shippingCost),
    total:        Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      subtotal:  Number(item.subtotal),
    })),
  };
}

// -- cancelOrder -----------------------------------------------
export async function cancelOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where:  { id: orderId, userId },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError("Order tidak ditemukan.", 404);
  if (order.status !== "pending_payment")
    throw new AppError("Order tidak bisa dibatalkan.", 400);

  await prisma.order.update({
    where: { id: orderId },
    data:  { status: "cancelled" },
  });
  return { message: "Order dibatalkan." };
}

// -- confirmOrder ----------------------------------------------
// FIX #6: 2 UPDATE sequential ? 1 UPDATE langsung ke "confirmed".
// Sebelumnya:
//   update ? "processing"
//   // setTimeout di-comment tapi update ke-2 tetap ada
//   update ? "confirmed"
// = 2 DB roundtrips untuk hasil yang identik.
// Sesudahnya: 1 update langsung ke "confirmed" = 1 DB roundtrip.
export async function confirmOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where:  { id: orderId, userId },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError("Order tidak ditemukan.", 404);
  if (order.status !== "pending_payment")
    throw new AppError("Order tidak bisa dikonfirmasi.", 400);

  await prisma.order.update({
    where: { id: orderId },
    data:  { status: "confirmed" },
  });
  return { message: "Order dikonfirmasi." };
}

// -- shipOrder -------------------------------------------------
export async function shipOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError("Order tidak ditemukan.", 404);
  if (order.status !== "confirmed")
    throw new AppError("Order tidak bisa dikirim.", 400);

  await prisma.order.update({
    where: { id: orderId },
    data:  { status: "shipped" },
  });
  return { message: "Order dikirim." };
}

// -- deliverOrder ----------------------------------------------
export async function deliverOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError("Order tidak ditemukan.", 404);
  if (order.status !== "shipped")
    throw new AppError("Order tidak bisa di-delivered.", 400);

  await prisma.order.update({
    where: { id: orderId },
    data:  { status: "delivered" },
  });
  return { message: "Order delivered." };
}