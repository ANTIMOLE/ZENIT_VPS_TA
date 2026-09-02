"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Flame, MapPin, ImageOff, Heart, ShoppingBag } from "lucide-react";
import { cn, formatPrice, formatSoldCount, truncate } from "@/lib/utils";
import { PLACEHOLDER_IMAGE, ROUTES } from "@/lib/constants";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const [imgSrc, setImgSrc] = useState<string>(
    product.images?.[0] || PLACEHOLDER_IMAGE
  );

  const [isLoaded, setIsLoaded] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);

  const handleImageLoad = () => setIsLoaded(true);

  const handleImageError = () => {
    const localPath = product.images?.[1];
    setIsLoaded(false);

    if (localPath && imgSrc !== `/${localPath}`) {
      setImgSrc(`/${localPath}`);
    } else if (imgSrc !== PLACEHOLDER_IMAGE) {
      setImgSrc(PLACEHOLDER_IMAGE);
    } else {
      setIsExhausted(true);
    }
  };

  const hasDiscount = !!product.discount && product.discount > 0;

  const originalPrice = hasDiscount
    ? Math.round(product.price / (1 - product.discount! / 100))
    : null;

  return (
    <Link
      href={ROUTES.PRODUCT_DETAIL(product.slug)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl",
        "bg-white border border-black/[0.06]",
        "shadow-[0_2px_10px_-2px_rgba(15,23,42,0.08)]",
        // Cuma transform + shadow yang animasi — dua-duanya compositor-only,
        // gak trigger repaint mahal kayak backdrop-filter.
        "transition-[transform,box-shadow] duration-300 ease-out",
        "hover:-translate-y-1.5 hover:shadow-[0_16px_32px_-10px_rgba(15,23,42,0.22)]",
        "outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
        "active:scale-[0.99]",
        className
      )}
    >
      {/* ===================================================
          IMAGE
      =================================================== */}
      <div className="relative aspect-square overflow-hidden bg-[#f7f7f8] isolate">
        <div
          className={cn(
            "absolute inset-0 animate-pulse bg-[#efeff1] transition-opacity duration-300",
            !isLoaded && !isExhausted ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5",
            "bg-gradient-to-br from-[#f8f8f9] to-[#eeeef0] text-[#c7c7cc]",
            "transition-opacity duration-300",
            isExhausted ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <ImageOff className="w-6 h-6" />
          <span className="text-[10px] font-medium">Gambar tidak tersedia</span>
        </div>

        {!isExhausted ? (
          <Image
            key={imgSrc}
            src={imgSrc}
            alt={product.name}
            fill
            className={cn(
              "object-cover transition-transform duration-300 ease-out",
              "group-hover:scale-[1.04]",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onLoad={handleImageLoad}
            onError={handleImageError}
            unoptimized={imgSrc.startsWith("http")}
            draggable={false}
          />
        ) : null}

        {!isExhausted ? (
          <div
            className="
              pointer-events-none absolute inset-x-0 bottom-0 h-20
              bg-gradient-to-t from-black/40 to-transparent
              opacity-0 transition-opacity duration-300
              group-hover:opacity-100
            "
          />
        ) : null}

        {hasDiscount ? (
          <span
            className="
              absolute top-2.5 left-2.5
              inline-flex items-center gap-1
              rounded-lg
              bg-black/50
              px-2 py-1
              text-[10px] font-bold text-white
            "
          >
            <Flame className="w-2.5 h-2.5 text-orange-400" />
            {product.discount}%
          </span>
        ) : null}

        {/* Quick-action panel. Blur di sini murah karena areanya cuma 2
            tombol kecil, bukan seluruh card. */}
        {!isExhausted ? (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3",
              "translate-y-2 opacity-0",
              "transition-[opacity,transform] duration-300 ease-out",
              "group-hover:translate-y-0 group-hover:opacity-100"
            )}
          >
            <button
              type="button"
              aria-label="Simpan ke wishlist"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                "bg-white/20 backdrop-blur-md border border-white/25",
                "transition-colors duration-200 hover:bg-white/35",
                "outline-none focus:outline-none"
              )}
            >
              <Heart className="h-3.5 w-3.5 text-white" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                "flex h-9 flex-1 max-w-[160px] items-center justify-center gap-1.5 rounded-full",
                "bg-white/20 backdrop-blur-md border border-white/25",
                "transition-colors duration-200 hover:bg-white/35",
                "text-[12px] font-semibold text-white",
                "outline-none focus:outline-none"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Tambah
            </button>
          </div>
        ) : null}
      </div>

      {/* ===================================================
          INFO
      =================================================== */}
      <div className="flex flex-col gap-1.5 p-3.5">
        {/* min-h reserve 2 baris — nama 1 baris atau 2 baris, tinggi block
            ini selalu sama, jadi harga/rating gak geser antar card. */}
        <p
          className="
            min-h-[2.375rem]
            text-[13.5px] leading-snug font-semibold text-[#1a1a1a] line-clamp-2
            tracking-[-0.01em]
          "
        >
          {truncate(product.name, 60)}
        </p>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <p className="text-[17px] font-bold text-primary tracking-tight">
            {formatPrice(product.price)}
          </p>

          {hasDiscount && originalPrice ? (
            <p className="text-[11px] font-medium text-[#999] line-through">
              {formatPrice(originalPrice)}
            </p>
          ) : null}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-[#666] mt-0.5">
          {product.rating ? (
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              {product.rating}
            </span>
          ) : null}
          {product.rating ? <span className="text-[#d4d4d8]">·</span> : null}
          <span className="font-medium">{formatSoldCount(product.soldCount)} terjual</span>
        </p>

        {product.location ? (
          <p className="flex items-center gap-1 text-[11px] text-[#888] truncate">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
            <span className="font-medium">{product.location}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white border border-black/[0.06] shadow-[0_2px_10px_-2px_rgba(15,23,42,0.08)] animate-pulse">
      <div className="aspect-square bg-[#f0f0f0]" />
      <div className="flex flex-col gap-2 p-3.5">
        <div className="h-3.5 bg-[#f0f0f0] rounded w-full" />
        <div className="h-3.5 bg-[#f0f0f0] rounded w-3/4" />
        <div className="h-4.5 bg-[#f0f0f0] rounded w-1/2 mt-1" />
        <div className="h-2.5 bg-[#f0f0f0] rounded w-2/3" />
      </div>
    </div>
  );
}