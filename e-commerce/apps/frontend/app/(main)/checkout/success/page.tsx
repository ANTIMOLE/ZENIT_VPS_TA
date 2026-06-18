"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Package, ArrowRight, ShoppingBag, CircleDot, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/lib/constants";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId      = searchParams.get("orderId");
  const orderNumber  = searchParams.get("orderNumber");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">

        <div className="flex justify-center mb-5">
          <div className="animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-14 h-14 text-[#7132f5]" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#111] mb-2 tracking-tight">Pesanan Berhasil</h1>
        <p className="text-[#888] mb-6">
          Terima kasih sudah berbelanja di Zenit. Pesanan kamu sedang kami proses.
        </p>

        {orderNumber && (
          <div className="bg-[#fafaf9] rounded-lg border border-[#ebebeb] p-5 mb-6 text-left">
            <p className="text-xs text-[#888] mb-1">Nomor Pesanan</p>
            <p className="font-mono font-bold text-lg text-[#111]">{orderNumber}</p>
            <p className="text-xs text-[#aaa] mt-1">
              Simpan nomor ini untuk melacak status pesananmu.
            </p>
          </div>
        )}

        <div className="bg-white border border-[#ebebeb] rounded-lg p-5 mb-6 text-left space-y-3">
          {[
            { icon: <CheckCircle2 className="w-4 h-4 text-[#7132f5]" />, label: "Pesanan diterima",     sub: "Kami sudah menerima pesananmu" },
            { icon: <Package      className="w-4 h-4 text-[#aaa]" />,    label: "Dikemas",              sub: "Pesanan sedang disiapkan" },
            { icon: <Truck        className="w-4 h-4 text-[#aaa]" />,    label: "Dikirim ke alamatmu", sub: "Estimasi 1-5 hari kerja" },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
              <div>
                <p className="text-sm font-medium text-[#333]">{s.label}</p>
                <p className="text-xs text-[#aaa]">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="mb-6" />

        <div className="flex flex-col gap-3">
          {orderId && (
            <Button className="w-full gap-2" size="lg" asChild>
              <Link href={ROUTES.ORDER_DETAIL(orderId)}>
                <Package className="w-4 h-4" />
                Lihat Detail Pesanan
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href={ROUTES.ORDERS}>Semua Pesanan Saya</Link>
          </Button>
          <Button variant="ghost" className="w-full gap-2 text-[#888]" asChild>
            <Link href={ROUTES.PRODUCTS}>
              <ShoppingBag className="w-4 h-4" /> Lanjut Belanja
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
