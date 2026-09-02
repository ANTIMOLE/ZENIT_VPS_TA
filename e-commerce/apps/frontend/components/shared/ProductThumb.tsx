"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  /** Product's image list (or a single already-resolved URL wrapped in an array). */
  images?: (string | null | undefined)[] | null;
  alt: string;
  /** Matches the `sizes` prop next/image needs for a `fill` container. */
  sizes?: string;
  className?: string;
}

// ── ProductThumb ────────────────────────────────────────────────
// One place for "what do we show when a product photo won't load", used
// by cart, checkout summary, and order history/detail.
//
// This mattered enough to centralize because the bug kept recurring in
// slightly different broken forms across pages:
//   - some places had no onError handler at all (a 403'd/expired image
//     just renders as a blank/broken box, forever)
//   - others "fixed" it by mutating e.target.src directly in onError —
//     which fights next/image's own internal load-state tracking and is
//     what caused the visible glitching/collapsing on small thumbnails
// The fix is the same one already used on the product detail page: swap
// `src` through React state so next/image re-renders normally instead of
// having its DOM node changed out from under it.
//
// Falls through: images[0] -> images[1] (e.g. a local /public copy) ->
// static placeholder -> (if even that 404s) a plain muted icon, so there's
// always something reasonable on screen instead of a broken-image icon.
export function ProductThumb({ images, alt, sizes = "80px", className }: ProductThumbProps) {
  const first = images?.[0] || undefined;
  const [imgSrc, setImgSrc] = useState<string | null>(first ?? PLACEHOLDER_IMAGE);
  const [placeholderFailed, setPlaceholderFailed] = useState(false);

  function handleError() {
    const fallback = images?.[1];
    if (fallback && imgSrc !== fallback && imgSrc !== `/${fallback}`) {
      setImgSrc(fallback.startsWith("/") ? fallback : `/${fallback}`);
    } else if (imgSrc !== PLACEHOLDER_IMAGE) {
      setImgSrc(PLACEHOLDER_IMAGE);
    } else {
      // Even the local placeholder asset failed — stop trying to render
      // an <img> at all and show a plain icon instead.
      setPlaceholderFailed(true);
    }
  }

  if (placeholderFailed || !imgSrc) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-300", className)}>
        <Package className="h-1/3 w-1/3" />
      </div>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={handleError}
      unoptimized={imgSrc.startsWith("http")}
    />
  );
}
