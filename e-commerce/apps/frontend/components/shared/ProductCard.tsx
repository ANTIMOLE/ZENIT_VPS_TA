"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { cn, formatPrice, formatSoldCount, truncate } from "@/lib/utils";
import { PLACEHOLDER_IMAGE, ROUTES } from "@/lib/constants";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  // [FIX] Fallback chain: images[0] (tokopedia URL) → images[1] (local /public/) → placeholder
  //
  // BUG LAMA: getImageUrl() mengembalikan PLACEHOLDER_IMAGE kalau URL expired,
  // sehingga imgSrc langsung jadi placeholder — onError tidak pernah firing,
  // dan images[1] tidak pernah dicoba.
  //
  // FIX: Inisialisasi dengan URL mentah (images[0]). Biarkan browser yang
  // mencoba fetch dan trigger onError kalau gagal (expired/404/network error).
  // Seluruh fallback chain dikelola di handleImageError.
  const [imgSrc, setImgSrc] = useState<string>(
    product.images[0] || PLACEHOLDER_IMAGE
  );

  const handleImageError = () => {
    const localPath = product.images[1]; // e.g. "images/category/slug.jpg"
    if (localPath && imgSrc !== `/${localPath}`) {
      setImgSrc(`/${localPath}`);
    } else if (imgSrc !== PLACEHOLDER_IMAGE) {
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  return (
    <Link
      href={ROUTES.PRODUCT_DETAIL(product.slug)}
      className={cn(
        "group flex flex-col bg-white rounded-lg border border-[#ebebeb] overflow-hidden",
        "hover:border-primary/20 hover: transition-all duration-150",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[#f8f8f8]">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onError={handleImageError}
          unoptimized={imgSrc.startsWith("http")}
        />
        {/* Discount badge */}
        {product.discount && product.discount > 0 ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-[4px]">
            -{product.discount}%
          </span>
        ) : null}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2.5">
        {/* Name */}
        <p className="text-[13px] text-[#333] leading-snug line-clamp-2 font-normal">
          {truncate(product.name, 60)}
        </p>

        {/* Price */}
        <p className="text-[15px] font-semibold text-primary mt-0.5 tracking-tight">
          {formatPrice(product.price)}
        </p>

        {/* Rating + Sold */}
        <div className="flex items-center gap-1 text-[11px] text-[#999] mt-0.5">
          {product.rating ? (
            <>
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-[#ddd]">·</span>
            </>
          ) : null}
          <span>{formatSoldCount(product.soldCount)} terjual</span>
        </div>

        {/* Location */}
        {product.location ? (
          <p className="text-[11px] text-[#bbb] truncate mt-0.5">{product.location}</p>
        ) : null}
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-lg border border-[#ebebeb] overflow-hidden animate-pulse">
      <div className="aspect-square bg-[#f0f0f0]" />
      <div className="flex flex-col gap-2 p-2.5">
        <div className="h-3 bg-[#f0f0f0] rounded w-full" />
        <div className="h-3 bg-[#f0f0f0] rounded w-3/4" />
        <div className="h-4 bg-[#f0f0f0] rounded w-1/2 mt-1" />
        <div className="h-2.5 bg-[#f0f0f0] rounded w-2/3" />
      </div>
    </div>
  );
}
