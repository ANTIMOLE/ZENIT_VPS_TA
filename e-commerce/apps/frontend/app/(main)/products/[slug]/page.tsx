"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Star, MapPin, ShoppingCart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useProductDetail } from "@/hooks/useProducts";
import { formatPrice, formatSoldCount } from "@/lib/utils";
import { PLACEHOLDER_IMAGE, ROUTES } from "@/lib/constants";
import { useCart } from "@/hooks/useCart";

// ── ProductDetailImage ──────────────────────────────────────
// Sub-component terpisah agar useState untuk fallback image
// tidak melanggar Rules of Hooks (ada conditional return di atas).
// Fallback chain: images[0] (tokopedia) → images[1] (local /public/) → placeholder
function ProductDetailImage({
  images,
  name,
  discount,
}: {
  images: string[];
  name: string;
  discount?: number | null;
}) {
  // [FIX] Inisialisasi dengan URL mentah — JANGAN lewat getImageUrl() dulu.
  // getImageUrl() yang lama mengembalikan PLACEHOLDER_IMAGE untuk URL expired,
  // sehingga onError tidak pernah firing dan images[1] tidak pernah dicoba.
  // Sekarang biarkan browser yang mencoba fetch dan trigger onError jika gagal.
  const [imgSrc, setImgSrc] = useState<string>(images[0] || PLACEHOLDER_IMAGE);

  const handleError = () => {
    const localPath = images[1]; // e.g. "images/category/slug.jpg"
    if (localPath && imgSrc !== `/${localPath}`) {
      // Step 2: coba copy lokal di /public/
      setImgSrc(`/${localPath}`);
    } else if (imgSrc !== PLACEHOLDER_IMAGE) {
      // Step 3: fallback ke placeholder
      setImgSrc(PLACEHOLDER_IMAGE);
    }
    // Guard: kalau sudah placeholder, stop — jangan infinite loop
  };

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-[#f8f8f8]">
      <Image
        src={imgSrc}
        alt={name}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 384px"
        priority
        onError={handleError}
        // unoptimized untuk URL eksternal tokopedia agar tidak kena Next.js
        // image optimization error saat URL expired/berubah format
        unoptimized={imgSrc.startsWith("http")}
      />
      {discount && discount > 0 ? (
        <span className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-[4px]">
          -{discount}%
        </span>
      ) : null}
    </div>
  );
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: Props) {
  const { slug } = use(params);
  const router   = useRouter();
  const { addItem, isAddingItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, isError } = useProductDetail(slug);

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen ">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="rounded-2xl border border-zinc-20 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-7">
              <Skeleton className="w-full md:w-96 aspect-square rounded-2xl" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <div className="flex gap-3 pt-4">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ───────────────────────────────────────
  if (isError || !product) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="rounded-2xl border border-zinc-200 bg-white p-10">
            <EmptyState
              emoji="😕"
              title="Produk tidak ditemukan"
              description="Produk ini mungkin sudah tidak tersedia atau linknya salah."
              action={{ label: "Kembali Belanja", onClick: () => router.push(ROUTES.PRODUCTS) }}
            />
          </div>
        </div>
      </div>
    );
  }

  const isAvailable = product.stock > 0;
  const isLowStock = isAvailable && product.stock <= 5;
  const discountedPrice = product.discount && product.discount > 0
    ? product.price * (1 - product.discount / 100)
    : null;

  function decrementQty() {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function incrementQty() {
    setQuantity((q) => Math.min(product!.stock, q + 1));
  }

  return (
    // Quiet, near-white page background on purpose — this route opts out
    // of the site-wide ShiftBackground. That treatment works for the auth
    // flow where there's no product to compete with; here the product
    // needs to be the thing the eye lands on, not the backdrop.
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Breadcrumb — earlier steps muted, current page dark so it
            doesn't disappear ──────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-sm mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-zinc-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali
          </button>
          <span className="text-zinc-300">/</span>
          <Link href={ROUTES.PRODUCTS} className="text-zinc-500 hover:text-primary transition-colors">
            Produk
          </Link>
          {product.category && (
            <>
              <span className="text-zinc-300">/</span>
              <Link
                href={`${ROUTES.PRODUCTS}?categoryId=${product.category.id}`}
                className="text-zinc-500 hover:text-primary transition-colors"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900 truncate max-w-48">{product.name}</span>
        </nav>

        {/* ── One restrained card: solid white, thin border, modest
            radius — not a hero section. ─────────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-7 md:flex-row">

            {/* Image */}
            <div className="w-full shrink-0 md:w-96">
              <ProductDetailImage
                images={product.images}
                name={product.name}
                discount={product.discount}
              />
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-3">

              {product.category && (
                <Link href={`${ROUTES.PRODUCTS}?categoryId=${product.category.id}`} className="w-fit">
                  <Badge variant="secondary" className="text-zinc-600 hover:bg-primary/10 transition-colors cursor-pointer">
                    {product.category.name}
                  </Badge>
                </Link>
              )}

              {/* Nama — the dominant text on the page */}
              <h1 className="text-2xl font-bold leading-snug text-zinc-900 sm:text-[1.75rem]">
                {product.name}
              </h1>

              {/* Metadata — deliberately quiet, one notch down from the
                  title/price */}
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                {product.rating ? (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-zinc-700">{product.rating}</span>
                  </span>
                ) : null}
                {product.rating ? <span>·</span> : null}
                <span>{formatSoldCount(product.soldCount)} terjual</span>
                {product.location && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {product.location}
                    </span>
                  </>
                )}
              </div>

              {/* Harga — dark and large, the second dominant element.
                  Purple is reserved for the buy button so there's only
                  one accent color competing for attention. */}
              <div className="flex flex-wrap items-end gap-2.5 pt-1">
                <p className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                  {discountedPrice ? formatPrice(discountedPrice) : formatPrice(product.price)}
                </p>
                {discountedPrice && (
                  <>
                    <p className="mb-1 text-base text-zinc-400 line-through">
                      {formatPrice(product.price)}
                    </p>
                    <span className="mb-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                      Hemat {product.discount}%
                    </span>
                  </>
                )}
              </div>

              {/* Stok — a dot + plain text, not a loud pill */}
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className={isAvailable ? "text-zinc-700" : "font-medium text-red-600"}>
                  {isAvailable ? `Stok tersedia · ${product.stock}` : "Stok habis"}
                </span>
                {isLowStock && (
                  <span className="text-xs font-medium text-red-500">Tinggal sedikit</span>
                )}
              </div>

              {/* Deskripsi */}
              {product.description && (
                <div className="border-t border-zinc-200 pt-4">
                  <p className="text-sm font-semibold text-zinc-800 mb-2">Deskripsi Produk</p>
                  <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Jumlah */}
              {isAvailable && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-sm font-medium text-zinc-700">Jumlah</span>
                  <div className="flex items-center rounded-lg border border-zinc-200 bg-white">
                    <button
                      type="button"
                      onClick={decrementQty}
                      disabled={quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-zinc-800 disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-zinc-800">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={incrementQty}
                      disabled={quantity >= product.stock}
                      className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-zinc-800 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* CTA — 40/60 split instead of one giant button next to a
                  tiny one; still reads as "primary + secondary" without
                  the cart button looking like an afterthought. */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={!isAvailable || isAddingItem}
                  onClick={() => addItem({ productId: product.id, quantity })}
                  className="flex-1 gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isAddingItem ? "Menambahkan..." : "Keranjang"}
                </Button>

                <Button
                  className="group flex-[1.6] gap-2"
                  disabled={!isAvailable || isAddingItem}
                  onClick={async () => {
                    await addItem({ productId: product.id, quantity });
                    router.push("/checkout");
                  }}
                >
                  Beli Sekarang
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>

              {!isAvailable && (
                <p className="text-xs text-red-400 text-center">
                  Produk ini sedang habis stok. Coba produk lain yang serupa.
                </p>
              )}

              {/* Info tambahan — one plain line */}
              <p className="text-xs text-zinc-400">
                Harga sudah termasuk pajak dan pengiriman tersedia ke seluruh Indonesia.
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}