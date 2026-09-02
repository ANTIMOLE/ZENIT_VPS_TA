"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Package, MapPin, CreditCard,
  Truck, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductThumb } from "@/components/shared/ProductThumb";
import { useOrderDetail, useCancelOrder } from "@/hooks/useOrders";
import { formatPrice, formatDateTime } from "@/lib/utils";
import type { OrderShippingAddressSnapshot } from "@/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

const PAYMENT_LABEL: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  qris:          "QRIS",
  cod:           "COD (Bayar di Tempat)",
};

const SHIPPING_LABEL: Record<string, string> = {
  regular: "Reguler (3-5 hari kerja)",
  express: "Express (1-2 hari kerja)",
};

// Status icon helper
function StatusIcon({ status }: { status: string }) {
  if (status === "delivered")  return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "cancelled")  return <XCircle      className="w-4 h-4 text-red-500"   />;
  return <Clock className="w-4 h-4 text-amber-500" />;
}

export default function OrderDetailPage({ params }: Props) {
  const { id }   = use(params);
  const router   = useRouter();

  const { data: order, isLoading, isError } = useOrderDetail(id);
  const cancelMutation = useCancelOrder();

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-5 w-24" />
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────
  if (isError || !order) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <EmptyState
            emoji="📦"
            title="Pesanan tidak ditemukan"
            description="Pesanan ini tidak ada atau bukan milikmu."
            action={{ label: "Lihat Semua Pesanan", onClick: () => router.push(ROUTES.ORDERS) }}
          />
        </div>
      </div>
    );
  }

  const canCancel = order.status === "pending_payment";
  const shippingAddr: OrderShippingAddressSnapshot = order.shippingAddress;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Pesanan
        </button>

        {/* ── Header Card ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Nomor Pesanan</p>
              <p className="font-mono font-bold text-zinc-900">{order.orderNumber}</p>
            </div>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1",
              ORDER_STATUS_COLOR[order.status]
            )}>
              <StatusIcon status={order.status} />
              <span className="ml-1">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Dipesan pada {formatDateTime(order.createdAt)}
          </p>

          {/* Cancel button */}
          {canCancel && (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(order.id)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                {cancelMutation.isPending ? "Membatalkan..." : "Batalkan Pesanan"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Item List ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-200">
            <Package className="w-4 h-4 text-zinc-400" />
            <p className="font-semibold text-sm text-zinc-900">Produk Dipesan</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {order.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-4">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                  <ProductThumb
                    images={item.productImage ? [item.productImage] : []}
                    alt={item.productName}
                    sizes="56px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 line-clamp-2">
                    {item.productName}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-zinc-800 shrink-0">
                  {formatPrice(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ringkasan Harga ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-2 text-sm">
          <p className="font-semibold text-zinc-900 mb-3">Ringkasan Pembayaran</p>
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-zinc-800">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">PPN (11%)</span>
            <span className="text-zinc-800">{formatPrice(order.tax)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Ongkos Kirim</span>
            <span className="text-zinc-800">{formatPrice(order.shippingCost)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span className="text-zinc-900">Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* ── Info Pengiriman ─────────────────────────────────── */}
        {shippingAddr && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-zinc-400" />
              <p className="font-semibold text-sm text-zinc-900">Alamat Pengiriman</p>
            </div>
            <p className="text-sm font-medium text-zinc-800">
              {shippingAddr.recipientName}
            </p>
            <p className="text-sm text-zinc-500 mt-0.5">{shippingAddr.phone}</p>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
              {shippingAddr.address}, {shippingAddr.city},{" "}
              {shippingAddr.province} {shippingAddr.zipCode}
            </p>
          </div>
        )}

        {/* ── Metode Pembayaran & Pengiriman ───────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="text-xs">Pembayaran</span>
            </div>
            <p className="font-medium text-zinc-800">
              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-xs">Pengiriman</span>
            </div>
            <p className="font-medium text-zinc-800">
              {SHIPPING_LABEL[order.shippingMethod] ?? order.shippingMethod}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
