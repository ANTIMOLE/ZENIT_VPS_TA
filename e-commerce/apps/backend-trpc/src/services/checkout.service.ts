import { PaymentMethod, ShippingMethod } from "@ecommerce/shared/generated/prisma";
import { TRPCError } from "@trpc/server";
import { prisma } from "../config/database";

const flatTax = 0.11;
const regular = 15_000;
const express = 35_000;

export async function calculateCheckoutSummary(userId: string, cartId: string, shippingMethod: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { userId: true, items: { select: { quantity: true, priceAtTime: true } } },
  });

  if (!cart || cart.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cart tidak ditemukan." });
  }

  const flatShipping = shippingMethod === "express" ? express : regular;
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.priceAtTime), 0
  );
  const tax   = subtotal * flatTax;
  const total = subtotal + tax + flatShipping;

  return { subtotal, tax, shippingCost: flatShipping, total };
}

export async function getCheckoutSummary(userId: string, orderNumber: string) {
  const checkout = await prisma.order.findFirst({
    where: { orderNumber, userId },
    select: {
      orderNumber: true, status: true, total: true, subtotal: true, tax: true,
      shippingAddress: true, shippingCost: true, paymentMethod: true, shippingMethod: true,
      user: { select: { name: true, email: true, phone: true } },
      address: {
        select: {
          recipientName: true, phone: true, address: true,
          city: true, zipCode: true, province: true,
        },
      },
      items: {
        select: {
          id: true, orderId: true, productId: true, productName: true,
          quantity: true, unitPrice: true, subtotal: true,
          product: { select: { slug: true, images: true, stock: true } },
        },
      },
    },
  });

  if (!checkout) throw new TRPCError({ code: "NOT_FOUND", message: "Checkout not found." });

  // FIX: Prisma Decimal ter-serialize ke string saat JSON.stringify.
  // Manual convert ke number supaya typeof total === 'number' di client.
  return {
    ...checkout,
    total:        Number(checkout.total),
    subtotal:     Number(checkout.subtotal),
    tax:          Number(checkout.tax),
    shippingCost: Number(checkout.shippingCost),
    items: (checkout.items ?? []).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      subtotal:  Number(item.subtotal),
    })),
  };
}

export async function confirmCheckout(
  userId:         string,
  cartId:         string,
  addressId:      string,
  paymentMethod:  string,
  shippingMethod: string
) {
  if (!Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid payment method." });
  }
  if (!Object.values(ShippingMethod).includes(shippingMethod as ShippingMethod)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid shipping method." });
  }

  // Verifikasi kepemilikan address sebelum masuk tx
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Address tidak ditemukan." });
  }

  const addressJSON = {
    recipientName: address.recipientName,
    phone:         address.phone,
    address:       address.address,
    city:          address.city,
    province:      address.province,
    zipCode:       address.zipCode,
  };

  const flatShipping = shippingMethod === "express" ? express : regular;

  const order = await prisma.$transaction(async (tx) => {
    // Filter cart by id AND userId dalam tx — cegah checkout cart milik orang lain
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
      select: {
        userId: true,
        items: { select: { productId: true, quantity: true, priceAtTime: true } },
      },
    });

    if (!cart || cart.userId !== userId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cart tidak ditemukan." });
    }

    if (cart.items.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty." });
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.priceAtTime), 0
    );
    const tax   = subtotal * flatTax;
    const total = subtotal + tax + flatShipping;

    const productIds = cart.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where:  { id: { in: productIds } },
      select: { id: true, stock: true, name: true },
    });

    for (const item of cart.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock < item.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Stok ${product?.name ?? item.productId} tidak cukup.`,
        });
      }
    }

    // FIX [orderNumber collision]: Date.now() resolusinya ms — 2 VU checkout
    // dalam ms yang sama ? duplicate order_number ? unique constraint ? 409.
    // Random suffix 8 char membuat collision probability practically zero.
    const newOrder = await tx.order.create({
      data: {
        userId,
        orderNumber:    `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        subtotal,
        tax,
        shippingCost:   flatShipping,
        total,
        paymentMethod:  paymentMethod as PaymentMethod,
        shippingMethod: shippingMethod as ShippingMethod,
        addressId,
        shippingAddress: addressJSON,
        items: {
          create: cart.items.map((item) => ({
            productId:   item.productId,
            quantity:    item.quantity,
            unitPrice:   item.priceAtTime,
            subtotal:    item.quantity * Number(item.priceAtTime),
            productName: products.find((p) => p.id === item.productId)?.name ?? "Unknown Product",
          })),
        },
      },
      include: { items: true },
    });

    // FIX [deadlock]: Promise.all dalam satu tx ? concurrent lock requests ?
    // circular wait antar transaksi ? deadlock. Sort by productId memastikan
    // semua tx lock rows dalam urutan yang sama ? tidak ada circular wait.
    const sortedItems = [...cart.items].sort((a, b) =>
      a.productId.localeCompare(b.productId)
    );

    for (const item of sortedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock:     { decrement: item.quantity },
          soldCount: { increment: item.quantity },
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId } });
    await tx.cart.update({ where: { id: cartId }, data: { status: "checked_out" } });

    return newOrder;
  });

  return order;
}