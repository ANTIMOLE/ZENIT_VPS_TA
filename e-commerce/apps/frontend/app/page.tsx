"use client";

import Link from "next/link";

import {
  ArrowRight,
  ShoppingBag,
  Tag,
  Truck,
  ShieldCheck,
  Zap,
  Smartphone,
  Cpu,
  Shirt,
  BookOpen,
  ChefHat,
  Music2,
  Lightbulb,
  Headphones,
  Gamepad2,
  Camera,
  Baby,
  GraduationCap,
  Tablet,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/shared/ProductCard";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useBestsellers } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants";
import type { Category } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";

// =================================================================
// CATEGORY GROUPING
// =================================================================

interface CategoryGroup {
  key: string;
  label: string;
  Icon: LucideIcon;
  categories: Category[];
}

const GROUP_META: Record<
  string,
  { label: string; Icon: LucideIcon }
> = {
  hp: {
    label: "HP & Aksesoris",
    Icon: Smartphone,
  },
  elektronik: {
    label: "Elektronik",
    Icon: Cpu,
  },
  "fashion-wanita": {
    label: "Fashion Wanita",
    Icon: Shirt,
  },
  "fashion-pria": {
    label: "Fashion Pria",
    Icon: Shirt,
  },
  "fashion-muslim": {
    label: "Busana Muslim",
    Icon: Shirt,
  },
  "fashion-anak": {
    label: "Fashion Anak",
    Icon: Baby,
  },
  "fashion-bayi": {
    label: "Pakaian Bayi",
    Icon: Baby,
  },
  "fashion-seragam": {
    label: "Seragam",
    Icon: GraduationCap,
  },
  kamera: {
    label: "Kamera & Lensa",
    Icon: Camera,
  },
  "aksesoris-kamera": {
    label: "Aksesoris Kamera",
    Icon: Camera,
  },
  audio: {
    label: "Audio",
    Icon: Headphones,
  },
  gaming: {
    label: "Gaming",
    Icon: Gamepad2,
  },
  tablet: {
    label: "Tablet",
    Icon: Tablet,
  },
  buku: {
    label: "Buku",
    Icon: BookOpen,
  },
  novel: {
    label: "Novel",
    Icon: BookOpen,
  },
  komik: {
    label: "Komik & Manga",
    Icon: BookMarked,
  },
  dapur: {
    label: "Peralatan Dapur",
    Icon: ChefHat,
  },
  film: {
    label: "Alat Musik",
    Icon: Music2,
  },
  lighting: {
    label: "Lighting",
    Icon: Lightbulb,
  },
};

const GROUP_ORDER = [
  "hp",
  "elektronik",
  "fashion-wanita",
  "fashion-pria",
  "fashion-muslim",
  "fashion-anak",
  "fashion-bayi",
  "fashion-seragam",
  "kamera",
  "aksesoris-kamera",
  "audio",
  "gaming",
  "tablet",
  "buku",
  "novel",
  "komik",
  "dapur",
  "film",
  "lighting",
];

const KEY_ALIAS: Record<string, string> = {
  "hp-aksesoris": "hp",
  lensa: "kamera",
  drone: "kamera",
  al: "buku",
  alkitab: "buku",
};

function getGroupKey(slug: string): string {
  const parts = slug.split("-");

  const twoKey = `${parts[0]}-${parts[1]}`;

  if (GROUP_META[twoKey]) return twoKey;
  if (KEY_ALIAS[twoKey]) return KEY_ALIAS[twoKey];

  const oneKey = parts[0];

  if (KEY_ALIAS[oneKey]) return KEY_ALIAS[oneKey];

  return oneKey;
}

function groupCategories(categories: Category[]): CategoryGroup[] {
  const map = new Map<string, Category[]>();

  for (const cat of categories) {
    const key = getGroupKey(cat.slug);

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(cat);
  }

  const groups: CategoryGroup[] = [];

  for (const [key, cats] of map.entries()) {
    const meta = GROUP_META[key];

    groups.push({
      key,
      label:
        meta?.label ??
        key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      Icon: meta?.Icon ?? ShoppingBag,
      categories: cats,
    });
  }

  groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.key);
    const bi = GROUP_ORDER.indexOf(b.key);

    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;

    return a.label.localeCompare(b.label, "id");
  });

  return groups;
}

// =================================================================
// TRUST STRIP DATA
// =================================================================

const TRUST_ITEMS = [
  {
    Icon: Truck,
    label: "Gratis Ongkir",
    sub: "Min. belanja 50rb",
  },
  {
    Icon: ShieldCheck,
    label: "Garansi Uang Kembali",
    sub: "7 hari retur",
  },
  {
    Icon: Zap,
    label: "Same Day Delivery",
    sub: "Order sebelum jam 12",
  },
];

// =================================================================
// PAGE
// =================================================================

export default function HomePage() {
  const {
    data: products,
    isLoading: loadingProducts,
  } = useBestsellers();

  const {
    data: categories,
    isLoading: loadingCategories,
  } = useCategories();

  const { isAuthenticated } = useAuth();

  const groups = useMemo(
    () => (categories ? groupCategories(categories) : []),
    [categories]
  );

  // ===============================================================
  // HERO PARALLAX — refs + rAF, no React re-render on scroll
  // ===============================================================
  const heroOrb1Ref = useRef<HTMLDivElement>(null);
  const heroOrb2Ref = useRef<HTMLDivElement>(null);
  const heroOrb3Ref = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;
    let ticking = false;

    const applyParallax = () => {
      ticking = false;
      const scrollY = window.scrollY;

      if (heroOrb1Ref.current) {
        heroOrb1Ref.current.style.transform = `translateY(${scrollY * 0.35}px)`;
      }
      if (heroOrb2Ref.current) {
        heroOrb2Ref.current.style.transform = `translateY(${scrollY * 0.2}px) translateX(-50%)`;
      }
      if (heroOrb3Ref.current) {
        heroOrb3Ref.current.style.transform = `translateY(${scrollY * 0.45}px)`;
      }
      if (heroContentRef.current) {
        heroContentRef.current.style.transform = `translateY(${scrollY * 0.12}px)`;
        heroContentRef.current.style.opacity = `${Math.max(1 - scrollY / 450, 0.25)}`;
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = window.requestAnimationFrame(applyParallax);
      }
    };

    applyParallax();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // ===============================================================
  // CATEGORY CAROUSEL
  // ===============================================================

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const hasDragged = useRef(false);
  // [FIX] Tracks the pointerId between pointerdown and the moment (if any)
  // a real drag is confirmed, so we know which pointer to capture — see
  // handleCategoryPointerMove for why capture itself is deferred.
  const activePointerId = useRef<number | null>(null);

  const scrollCategories = (
    direction: "left" | "right"
  ) => {
    const el = categoryScrollRef.current;

    if (!el) return;

    el.scrollBy({
      left: direction === "right" ? 380 : -380,
      behavior: "smooth",
    });
  };

  // ---------------------------------------------------------------
  // HARD LOCK WHEEL TO CATEGORY CAROUSEL (unchanged)
  // ---------------------------------------------------------------

  useEffect(() => {
    const el = categoryScrollRef.current;

    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      el.scrollLeft += delta;
    };

    el.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      el.removeEventListener(
        "wheel",
        handleWheel,
        { capture: true } as EventListenerOptions
      );
    };
  }, []);

  // ---------------------------------------------------------------
  // Drag start
  // ---------------------------------------------------------------
  //
  // [FIX] This used to call el.setPointerCapture(event.pointerId) right
  // here, unconditionally, on every pointerdown — including a plain click
  // with zero movement. Once a pointer is captured, the browser retargets
  // that pointer's compatibility mouse events (mousedown/mouseup/click) to
  // the CAPTURING element instead of whatever was actually under the
  // cursor. Since capture was set on the scroll container (an ancestor of
  // every category <Link>), every click's `click` event ended up targeting
  // the container, not the link — so the link's navigation never fired.
  // That's the whole bug: it wasn't about hasDragged/preventDefault at all,
  // clicks were being intercepted before they ever reached the <Link>.
  //
  // Fix: don't capture yet. Just record where the press started. Capture
  // only gets set later, in handleCategoryPointerMove, and only once we've
  // confirmed the pointer actually moved far enough to count as a drag.
  // A plain click never moves past that threshold, so it never gets
  // captured, so its click event reaches the <Link> normally.
  const handleCategoryPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const el = categoryScrollRef.current;

    if (!el) return;

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    isDragging.current = true;
    hasDragged.current = false;
    activePointerId.current = event.pointerId;

    dragStartX.current = event.clientX;
    dragStartScrollLeft.current = el.scrollLeft;

    // No setPointerCapture here on purpose — see note above.
  };

  // ---------------------------------------------------------------
  // Drag move
  // ---------------------------------------------------------------

  const handleCategoryPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const el = categoryScrollRef.current;

    if (!el || !isDragging.current) return;

    const delta = event.clientX - dragStartX.current;

    // [FIX] The moment (and only the moment) movement crosses the
    // threshold, this is confirmed as a real drag: capture the pointer now
    // (so the rest of the drag tracks smoothly even if the cursor leaves
    // the element) and stop native scroll-snapping from fighting the drag.
    if (!hasDragged.current && Math.abs(delta) > 5) {
      hasDragged.current = true;

      if (activePointerId.current !== null) {
        el.setPointerCapture(activePointerId.current);
      }

      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
    }

    // Before the threshold is crossed, treat this as "might still just be
    // a click" — don't move the scroll position and don't preventDefault,
    // so a simple click/tap is left completely alone.
    if (!hasDragged.current) return;

    el.scrollLeft = dragStartScrollLeft.current - delta;

    event.preventDefault();
  };

  // ---------------------------------------------------------------
  // Drag end
  // ---------------------------------------------------------------

  const handleCategoryPointerUp = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const el = categoryScrollRef.current;

    if (!el) return;

    isDragging.current = false;
    activePointerId.current = null;

    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    el.style.cursor = "grab";
    el.style.scrollSnapType = "x proximity";
  };

  // ---------------------------------------------------------------
  // Drag cancel
  // ---------------------------------------------------------------

  const handleCategoryPointerCancel = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const el = categoryScrollRef.current;

    if (!el) return;

    isDragging.current = false;
    activePointerId.current = null;

    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    el.style.cursor = "grab";
    el.style.scrollSnapType = "x proximity";
  };

  // ===============================================================
  // RENDER
  // ===============================================================

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col gap-0">

        {/* =======================================================
            HERO
        ======================================================== */}

        <section className="relative overflow-hidden text-white">

          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #7c3aed 0%, #5b21b6 45%, #3b0764 100%)",
            }}
          />

          <div
            className="
              absolute
              inset-0
              opacity-[0.07]
              pointer-events-none
            "
            style={{
              backgroundImage:
                `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          <div
            ref={heroOrb1Ref}
            className="
              absolute
              -top-24
              -right-20
              w-[400px]
              h-[400px]
              rounded-full
              bg-white/40
              blur-2xl
              pointer-events-none
              will-change-transform
            "
          />

          <div
            ref={heroOrb2Ref}
            className="
              absolute
              -bottom-16
              left-1/2
              w-[550px]
              h-[280px]
              rounded-full
              bg-fuchsia-200/25
              blur-2xl
              pointer-events-none
              will-change-transform
            "
            style={{ transform: "translateX(-50%)" }}
          />

          <div
            ref={heroOrb3Ref}
            className="
              absolute
              top-1
              -left-16
              w-72
              h-72
              rounded-full
              bg-white/45
              blur-xl
              pointer-events-none
              will-change-transform
            "
          />

          <div
            ref={heroContentRef}
            className="
              relative
              max-w-7xl
              mx-auto
              px-4
              sm:px-6
              pt-16
              pb-24
              md:pt-24
              md:pb-32
              will-change-transform
            "
          >
            <div className="max-w-2xl">

              <div className="inline-flex items-center gap-2 mb-6">
                <span className="
                  w-1.5
                  h-1.5
                  rounded-full
                  bg-emerald-400
                  animate-pulse
                " />

                <p className="
                  text-white
                  text-[12px]
                  font-medium
                  tracking-[0.2em]
                  uppercase
                ">
                  Marketplace Indonesia
                </p>
              </div>

              <h1 className="
                text-[2.75rem]
                sm:text-5xl
                md:text-[3.5rem]
                font-bold
                leading-[1.08]
                tracking-[-0.035em]
                mb-6
              ">
                Belanja 50.000+ Produk
                <br />
                <span className="text-white">
                  dalam Satu Platform
                </span>
              </h1>

              <p className="
                text-white
                text-base
                sm:text-lg
                md:text-xl
                max-w-lg
                mb-10
                leading-relaxed
              ">
                Dari elektronik sampai fashion
                semua siap dikirim ke seluruh
                Indonesia. Cepat, aman, dan gratis
                ongkir.
              </p>

              <div className="
                flex
                flex-wrap
                items-center
                gap-3
              ">
                <Button
                  size="lg"
                  className="
                    bg-white
                    text-[#5b21b6]
                    hover:bg-white/95
                    font-semibold
                    h-12
                    px-7
                    rounded-full
                    shadow-lg
                    shadow-black/10
                    transition-all
                    hover:scale-[1.02]
                    active:scale-[0.98]
                  "
                  asChild
                >
                  <Link href={ROUTES.PRODUCTS}>
                    Mulai Belanja
                    <ShoppingBag className="
                      ml-2.5
                      w-4
                      h-4
                    " />
                  </Link>
                </Button>

                {!isAuthenticated && (
                  <Button
                    size="lg"
                    variant="ghost"
                    className="
                      text-white/80
                      hover:text-white
                      hover:bg-white/10
                      h-12
                      px-6
                      rounded-full
                      border
                      border-white/15
                    "
                    asChild
                  >
                    <Link href={ROUTES.REGISTER}>
                      Daftar Gratis
                    </Link>
                  </Button>
                )}
              </div>

              <div className="
                mt-14
                flex
                flex-wrap
                items-center
                gap-x-6
                gap-y-3
                text-sm
                text-white/50
              ">
                <div className="
                  flex
                  items-center
                  gap-2
                ">
                  <Truck className="
                    w-4
                    h-4
                    text-white
                  " />

                  <span className="text-white">
                    Gratis Ongkir
                  </span>
                </div>

                <div className="
                  flex
                  items-center
                  gap-2
                ">
                  <ShieldCheck className="
                    w-4
                    h-4
                    text-white
                  " />

                  <span className="text-white">
                    Garansi 7 Hari
                  </span>
                </div>

                <div className="
                  flex
                  items-center
                  gap-2
                ">
                  <Zap className="
                    w-4
                    h-4
                    text-white
                  " />

                  <span className="text-white">
                    Same Day
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="
            absolute
            bottom-0
            left-0
            right-0
            h-28
            bg-gradient-to-t
            from-white
            to-transparent
            pointer-events-none
          " />
        </section>

        {/* =======================================================
            TRUST STRIP
        ======================================================== */}

        <section className="
          bg-white
          border-b
          border-[#ebebeb]
        ">
          <div className="
            max-w-7xl
            mx-auto
            px-4
          ">
            <div className="
              flex
              items-stretch
              divide-x
              divide-[#ebebeb]
            ">
              {TRUST_ITEMS.map(
                ({ Icon, label, sub }, i) => (
                  <div
                    key={i}
                    className="
                      flex-1
                      flex
                      items-center
                      justify-center
                      gap-3
                      py-3.5
                      px-3
                    "
                  >
                    <Icon className="
                      w-4
                      h-4
                      text-primary
                      flex-shrink-0
                      hidden
                      sm:block
                    " />

                    <div>
                      <p className="
                        text-[12px]
                        font-semibold
                        text-[#111]
                        hidden
                        sm:block
                      ">
                        {label}
                      </p>

                      <p className="
                        text-[11px]
                        text-[#999]
                        hidden
                        sm:block
                      ">
                        {sub}
                      </p>

                      <p className="
                        text-[11px]
                        font-medium
                        text-[#555]
                        sm:hidden
                      ">
                        {label}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* =======================================================
            CATEGORY
        ======================================================== */}

        <section className="
          bg-white
          border-b
          border-[#ececec]
        ">
          <div className="
            max-w-7xl
            mx-auto
            px-4
            py-6
            w-full
          ">

            <div className="
              flex
              items-end
              justify-between
              mb-4
            ">
              <div>
                <p className="
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-primary
                  mb-1
                ">
                  Jelajahi
                </p>

                <h2 className="
                  text-[18px]
                  font-bold
                  tracking-tight
                  text-[#111]
                ">
                  Belanja berdasarkan kategori
                </h2>

                <p className="
                  text-[12px]
                  text-[#888]
                  mt-1
                ">
                  Temukan produk sesuai kebutuhanmu
                </p>
              </div>

              <Link
                href={ROUTES.PRODUCTS}
                className="
                  hidden
                  sm:flex
                  items-center
                  gap-1.5
                  text-[12px]
                  font-semibold
                  text-primary
                  hover:gap-2
                  transition-all
                "
              >
                Lihat semua
                <ArrowRight className="
                  w-3.5
                  h-3.5
                " />
              </Link>
            </div>

            <div className="relative">

              <button
                type="button"
                onClick={() =>
                  scrollCategories("left")
                }
                className="
                  absolute
                  -left-4
                  top-1/2
                  -translate-y-1/2
                  z-20

                  w-10
                  h-10
                  rounded-full

                  bg-white
                  border
                  border-[#e4e4e4]

                  shadow-[0_3px_12px_rgba(0,0,0,0.08)]

                  flex
                  items-center
                  justify-center

                  text-[#444]

                  hover:text-primary
                  hover:border-primary/30
                  hover:shadow-[0_5px_16px_rgba(0,0,0,0.1)]

                  transition-all
                "
                aria-label="Kategori sebelumnya"
              >
                <ChevronLeft className="
                  w-4
                  h-4
                " />
              </button>

              <div
                ref={categoryScrollRef}
                onPointerDown={
                  handleCategoryPointerDown
                }
                onPointerMove={
                  handleCategoryPointerMove
                }
                onPointerUp={
                  handleCategoryPointerUp
                }
                onPointerCancel={
                  handleCategoryPointerCancel
                }
                className="
                  flex
                  gap-3

                  overflow-x-auto
                  overflow-y-hidden

                  px-5
                  py-1

                  cursor-grab
                  select-none

                  snap-x
                  snap-proximity

                  scroll-smooth

                  touch-pan-x

                  [scrollbar-width:none]
                  [&::-webkit-scrollbar]:hidden
                "
                style={{
                  overscrollBehaviorX: "contain",
                  overscrollBehaviorY: "none",
                  touchAction: "pan-x",
                }}
              >

                <Link
                  href={ROUTES.PRODUCTS}
                  data-category-card
                  draggable={false}
                  onClick={(event) => {
                    if (hasDragged.current) {
                      event.preventDefault();
                    }
                  }}
                  className="
                    group
                    flex-shrink-0
                    snap-start

                    w-[180px]
                    h-[76px]

                    rounded-xl

                    border
                    border-primary/30

                    bg-primary/[0.045]

                    px-4
                    py-3

                    flex
                    flex-col
                    justify-between

                    transition-all
                    duration-200

                    hover:-translate-y-0.5
                    hover:border-primary
                    hover:bg-primary/[0.07]
                  "
                >
                  <div className="
                    flex
                    items-center
                    justify-between
                  ">
                    <div className="
                      w-7
                      h-7
                      rounded-lg
                      bg-primary/10
                      flex
                      items-center
                      justify-center
                    ">
                      <ShoppingBag className="
                        w-3.5
                        h-3.5
                        text-primary
                      " />
                    </div>

                    <ArrowRight className="
                      w-3.5
                      h-3.5
                      text-primary
                      opacity-0
                      group-hover:opacity-100
                      transition-opacity
                    " />
                  </div>

                  <span className="
                    text-[12px]
                    font-semibold
                    text-[#222]
                  ">
                    Semua Produk
                  </span>
                </Link>

                {loadingCategories &&
                  Array.from({ length: 8 }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="
                          flex-shrink-0
                          w-[180px]
                          h-[76px]
                          rounded-xl
                          bg-[#f3f3f3]
                          animate-pulse
                        "
                      />
                    )
                  )}

                {!loadingCategories &&
                  groups.map((group) => {
                    const firstId =
                      group.categories[0]?.id;

                    const href = firstId
                      ? `${ROUTES.PRODUCTS}?categoryId=${firstId}`
                      : ROUTES.PRODUCTS;

                    const previewCategories =
                      group.categories
                        .slice(0, 2)
                        .map(
                          (c: Category) =>
                            c.name ??
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            c.label
                        )
                        .filter(Boolean)
                        .join(" · ");

                    return (
                      <Link
                        key={group.key}
                        href={href}
                        data-category-card
                        draggable={false}
                        onClick={(event) => {
                          if (
                            hasDragged.current
                          ) {
                            event.preventDefault();
                          }
                        }}
                        className="
                          group
                          flex-shrink-0
                          snap-start

                          w-[180px]
                          h-[76px]

                          rounded-xl

                          border
                          border-[#e8e8e8]

                          bg-white

                          px-4
                          py-3

                          flex
                          flex-col
                          justify-between

                          transition-all
                          duration-200

                          hover:-translate-y-0.5
                          hover:border-primary/30
                          hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]
                        "
                      >
                        <div className="
                          flex
                          items-center
                          justify-between
                        ">
                          <div className="
                            w-7
                            h-7
                            rounded-lg
                            bg-[#f5f5f5]

                            flex
                            items-center
                            justify-center

                            group-hover:bg-primary/10
                            transition-colors
                          ">
                            <group.Icon className="
                              w-3.5
                              h-3.5
                              text-[#777]
                              group-hover:text-primary
                              transition-colors
                            " />
                          </div>

                          <ArrowRight className="
                            w-3.5
                            h-3.5
                            text-[#aaa]

                            opacity-0
                            -translate-x-1

                            group-hover:opacity-100
                            group-hover:translate-x-0

                            transition-all
                          " />
                        </div>

                        <div className="min-w-0">
                          <p className="
                            text-[12px]
                            font-semibold
                            text-[#222]
                            truncate
                          ">
                            {group.label}
                          </p>

                          {previewCategories && (
                            <p className="
                              text-[10px]
                              text-[#999]
                              truncate
                              mt-0.5
                            ">
                              {previewCategories}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() =>
                  scrollCategories("right")
                }
                className="
                  absolute
                  -right-4
                  top-1/2
                  -translate-y-1/2
                  z-20

                  w-10
                  h-10
                  rounded-full

                  bg-white
                  border
                  border-[#e4e4e4]

                  shadow-[0_3px_12px_rgba(0,0,0,0.08)]

                  flex
                  items-center
                  justify-center

                  text-[#444]

                  hover:text-primary
                  hover:border-primary/30
                  hover:shadow-[0_5px_16px_rgba(0,0,0,0.1)]

                  transition-all
                "
                aria-label="Kategori berikutnya"
              >
                <ChevronRight className="
                  w-4
                  h-4
                " />
              </button>
            </div>

            <Link
              href={ROUTES.PRODUCTS}
              className="
                sm:hidden
                flex
                items-center
                justify-center
                gap-1.5
                mt-4

                text-[12px]
                font-semibold
                text-primary
              "
            >
              Lihat semua kategori

              <ArrowRight className="
                w-3.5
                h-3.5
              " />
            </Link>
          </div>
        </section>

      {/* =======================================================
    PROMO BANNER
======================================================= */}

<section className="max-w-7xl mx-auto px-4 pt-8 w-full">
  <div
    className="
      group
      relative
      overflow-hidden
      rounded-2xl
      text-white

      bg-gradient-to-br
      from-[#5B21D1]
      via-[#6D28D9]
      to-[#7C3AED]

      shadow-[0_14px_40px_rgba(91,33,209,0.16)]

      transition-all
      duration-500

      hover:-translate-y-[2px]
      hover:shadow-[0_20px_50px_rgba(91,33,209,0.23)]
    "
  >
    <div
      className="
        pointer-events-none
        absolute
        -right-20
        -top-24
        h-72
        w-72
        rounded-full
        bg-fuchsia-300/20
        blur-3xl

        transition-transform
        duration-700

        group-hover:scale-110
      "
    />

    <div
      className="
        pointer-events-none
        absolute
        -bottom-32
        left-[35%]
        h-64
        w-64
        rounded-full
        bg-indigo-300/15
        blur-3xl
      "
    />

    <div
      className="
        pointer-events-none
        absolute
        right-[23%]
        top-14
        h-1.5
        w-1.5
        rounded-full
        bg-white/25
      "
    />

    <div
      className="
        pointer-events-none
        absolute
        right-[27%]
        top-20
        h-1
        w-1
        rounded-full
        bg-white/15
      "
    />

    <div className="relative z-10 flex flex-col lg:flex-row">
      <div
        className="
          flex-1

          px-6
          py-8

          sm:px-8
          sm:py-9

          lg:px-10
          lg:py-10
        "
      >
        <div className="mb-5">
          <span
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-white/55
            "
          >
            Promo Hari Ini
          </span>
        </div>

        <div className="max-w-[610px]">
          <h3
            className="
              text-[38px]
              font-extrabold
              leading-[0.98]
              tracking-[-0.035em]

              sm:text-[44px]
              lg:text-[48px]
            "
          >
            <span className="text-white">
              Harga lagi turun.
            </span>

            <br />

            <span className="text-white/45">
              Saatnya belanja.
            </span>
          </h3>

          <p
            className="
              mt-5
              max-w-[500px]

              text-[14px]
              leading-6
              text-white/58

              sm:text-[15px]
            "
          >
            Diskon sampai{" "}
            <span className="font-semibold text-white/90">
              75%
            </span>{" "}
            buat produk yang lagi kamu incar.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <PromoCoupon />

          <Link
            href={`${ROUTES.PRODUCTS}?sortBy=soldCount&sortOrder=desc`}
            className="
              group/cta

              inline-flex
              h-12
              items-center
              gap-2.5

              rounded-xl
              bg-white

              px-5

              text-sm
              font-bold
              text-[#5B21D1]

              shadow-[0_8px_24px_rgba(0,0,0,0.12)]

              transition-all
              duration-300

              hover:bg-white
              hover:shadow-[0_12px_30px_rgba(0,0,0,0.17)]
              hover:gap-3

              active:scale-[0.97]
            "
          >
            Belanja sekarang

            <ArrowRight
              className="
                h-4
                w-4

                transition-transform
                duration-300

                group-hover/cta:translate-x-0.5
              "
            />
          </Link>
        </div>

        <div
          className="
            mt-6
            flex
            items-center
            gap-3

            text-[11px]
            text-white/38
          "
        >
          <span>Terbatas</span>

          <span className="text-white/15">•</span>

          <span>Produk pilihan</span>
        </div>
      </div>

      <div
        className="
          relative
          min-h-[260px]
          w-full

          border-t
          border-white/10

          overflow-hidden

          lg:min-h-[310px]
          lg:w-[40%]
          lg:border-l
          lg:border-t-0
        "
      >
        <div
          className="
            pointer-events-none
            absolute

            -right-12
            top-1/2

            -translate-y-1/2
            rotate-[-4deg]

            select-none

            text-[155px]
            font-black
            leading-none

            tracking-[-0.1em]

            text-white/[0.055]

            transition-all
            duration-700

            group-hover:translate-x-2
            group-hover:scale-[1.04]

            sm:text-[180px]
          "
        >
          75
        </div>

        <div
          className="
            absolute
            left-7
            top-8

            rotate-[-5deg]

            rounded-[18px]
            bg-white

            px-6
            py-4

            text-[#5B21D1]

            shadow-[0_18px_35px_rgba(0,0,0,0.16)]

            transition-all
            duration-500

            group-hover:rotate-[-2deg]
            group-hover:scale-[1.03]
          "
        >
          <p
            className="
              text-[10px]
              font-bold
              tracking-[0.18em]
              text-[#987BE8]
            "
          >
            SAMPAI
          </p>

          <p
            className="
              mt-0.5

              text-[38px]
              font-black
              leading-[0.85]

              tracking-[-0.06em]
            "
          >
            75%
          </p>
        </div>

        <div
          className="
            absolute
            right-7
            top-7

            flex
            items-center
            gap-2

            rounded-full

            border
            border-white/10

            bg-black/10

            px-3.5
            py-2

            text-[10px]
            font-medium
            text-white/65

            backdrop-blur-md

            transition-all
            duration-300

            group-hover:bg-black/15
          "
        >
          <span className="relative flex h-2 w-2">
            <span
              className="
                absolute
                inline-flex
                h-full
                w-full
                animate-ping
                rounded-full
                bg-yellow-300
                opacity-60
              "
            />

            <span
              className="
                relative
                inline-flex
                h-2
                w-2
                rounded-full
                bg-yellow-300
              "
            />
          </span>

          Lagi banyak dipakai
        </div>

        <Link
          href={`${ROUTES.PRODUCTS}?sortBy=soldCount&sortOrder=desc`}
          className="
            group/deal

            absolute
            bottom-7
            left-7
            right-7

            rounded-2xl

            border
            border-white/10

            bg-white/[0.07]

            px-5
            py-4

            backdrop-blur-md

            transition-all
            duration-300

            hover:border-white/15
            hover:bg-white/[0.10]
          "
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-white/35
                "
              >
                Cek promonya
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-white/90
                "
              >
                Siapa tahu barang incaranmu ikut.
              </p>
            </div>

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center

                rounded-full

                bg-white
                text-[#5B21D1]

                transition-transform
                duration-300

                group-hover/deal:translate-x-1
              "
            >
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  </div>
</section>

        {/* =======================================================
            BEST SELLERS
        ======================================================== */}

        <section className="
          max-w-7xl
          mx-auto
          px-4
          py-8
          w-full
        ">
          <div className="
            flex
            items-center
            justify-between
            mb-5
          ">
            <div>

              <div className="
                flex
                items-center
                gap-2.5
                mb-0.5
              ">
                <span className="
                  w-[3px]
                  h-5
                  rounded-full
                  bg-primary
                  flex-shrink-0
                " />

                <h2 className="
                  text-xl
                  font-bold
                ">
                  Produk Terlaris
                </h2>
              </div>

              <p className="
                text-sm
                text-[#000]
                pl-4.75
              ">
                Pilihan terpopuler dari pembeli Zenit
              </p>
            </div>

            <Link
              href={`${ROUTES.PRODUCTS}?sortBy=soldCount&sortOrder=desc`}
              className="
                text-sm
                text-primary
                flex
                items-center
                gap-1
                hover:underline
              "
            >
              Lihat Semua

              <ArrowRight className="
                w-3
                h-3
              " />
            </Link>
          </div>

          <div className="
            grid
            grid-cols-2
            sm:grid-cols-3
            md:grid-cols-4
            gap-4
          ">
            {loadingProducts
              ? Array.from({ length: 8 }).map(
                  (_, i) => (
                    <ProductCardSkeleton
                      key={i}
                    />
                  )
                )
              : products?.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
          </div>
        </section>

        {/* =======================================================
            CTA
        ======================================================== */}

        {!isAuthenticated && (
          <section className="
            relative
            overflow-hidden
            bg-[#0e0e12]
            text-white
            mt-4
          ">

            <div
              className="
                absolute
                inset-0
                pointer-events-none
                opacity-[0.10]
              "
              style={{
                backgroundImage:
                  "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="
              relative
              max-w-7xl
              mx-auto
              px-4
              py-12
              text-center
            ">
              <p className="
                text-[11px]
                font-semibold
                text-white/30
                tracking-[0.18em]
                uppercase
                mb-3
              ">
                Mulai Hari Ini
              </p>

              <h2 className="
                text-2xl
                font-bold
                mb-2
                tracking-tight
              ">
                Bergabung dengan Zenit Sekarang
              </h2>

              <p className="
                text-[#666]
                mb-7
                text-sm
              ">
                Daftar gratis dan mulai belanja sekarang.
              </p>

              <Button
                size="lg"
                className="
                  bg-white
                  text-[#111]
                  hover:bg-white/90
                  font-semibold
                  h-11
                  px-8
                  shadow-none
                "
                asChild
              >
                <Link href={ROUTES.REGISTER}>
                  Daftar Sekarang — Gratis
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}


function PromoCoupon() {
  const [copied, setCopied] = useState(false);

  const code = "HEMAT75";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard API can be unavailable in some environments.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Salin kode promo ${code}`}
      className="
        group/coupon

        inline-flex
        h-12
        items-center
        gap-3

        rounded-xl

        border
        border-white/15

        bg-black/10

        px-3.5
        pr-4

        text-left

        backdrop-blur-md

        transition-all
        duration-300

        hover:border-white/25
        hover:bg-black/15

        active:scale-[0.97]
      "
    >
      <div
        className="
          flex
          h-8
          w-8
          items-center
          justify-center

          rounded-lg

          bg-white/[0.09]

          transition-colors
          duration-300

          group-hover/coupon:bg-white/[0.14]
        "
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-300" />
        ) : (
          <Copy className="h-4 w-4 text-white/55" />
        )}
      </div>

      <div>
        <p
          className="
            text-[9px]
            font-medium
            uppercase
            tracking-[0.14em]
            text-white/35
          "
        >
          {copied ? "Tersalin" : "Pakai kode"}
        </p>

        <p
          className="
            mt-0.5
            font-mono
            text-sm
            font-bold
            tracking-[0.12em]
            text-white
          "
        >
          {code}
        </p>
      </div>

      <span
        className="
          hidden
          text-[10px]
          text-white/35
          transition-colors
          duration-200

          sm:inline

          group-hover/coupon:text-white/55
        "
      >
        {copied ? "Tersalin" : "Klik untuk salin"}
      </span>
    </button>
  );
}