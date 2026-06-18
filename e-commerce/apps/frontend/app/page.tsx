"use client";

import Link from "next/link";
import {
  ArrowRight, ShoppingBag, Tag,
  Truck, ShieldCheck, Zap,
  Smartphone, Cpu, Shirt, BookOpen, ChefHat,
  Music2, Lightbulb, Headphones, Gamepad2, Camera,
  Baby, GraduationCap, Tablet, BookMarked, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/ProductCard";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useBestsellers } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/constants";
import type { Category } from "@/types";

// =================================================================
// CATEGORY GROUPING
// =================================================================

interface CategoryGroup {
  key:        string;
  label:      string;
  Icon:       LucideIcon;
  categories: Category[];
}

const GROUP_META: Record<string, { label: string; Icon: LucideIcon }> = {
  "hp":               { label: "HP & Aksesoris",   Icon: Smartphone    },
  "elektronik":       { label: "Elektronik",        Icon: Cpu           },
  "fashion-wanita":   { label: "Fashion Wanita",    Icon: Shirt         },
  "fashion-pria":     { label: "Fashion Pria",      Icon: Shirt         },
  "fashion-muslim":   { label: "Busana Muslim",     Icon: Shirt         },
  "fashion-anak":     { label: "Fashion Anak",      Icon: Baby          },
  "fashion-bayi":     { label: "Pakaian Bayi",      Icon: Baby          },
  "fashion-seragam":  { label: "Seragam",           Icon: GraduationCap },
  "kamera":           { label: "Kamera & Lensa",    Icon: Camera        },
  "aksesoris-kamera": { label: "Aksesoris Kamera",  Icon: Camera        },
  "audio":            { label: "Audio",             Icon: Headphones    },
  "gaming":           { label: "Gaming",            Icon: Gamepad2      },
  "tablet":           { label: "Tablet",            Icon: Tablet        },
  "buku":             { label: "Buku",              Icon: BookOpen      },
  "novel":            { label: "Novel",             Icon: BookOpen      },
  "komik":            { label: "Komik & Manga",     Icon: BookMarked    },
  "dapur":            { label: "Peralatan Dapur",   Icon: ChefHat       },
  "film":             { label: "Alat Musik",        Icon: Music2        },
  "lighting":         { label: "Lighting",          Icon: Lightbulb     },
};

const GROUP_ORDER = [
  "hp", "elektronik", "fashion-wanita", "fashion-pria", "fashion-muslim",
  "fashion-anak", "fashion-bayi", "fashion-seragam", "kamera",
  "aksesoris-kamera", "audio", "gaming", "tablet",
  "buku", "novel", "komik", "dapur", "film", "lighting",
];

const KEY_ALIAS: Record<string, string> = {
  "hp-aksesoris": "hp",
  "lensa":        "kamera",
  "drone":        "kamera",
  "al":           "buku",
  "alkitab":      "buku",
};

function getGroupKey(slug: string): string {
  const parts  = slug.split("-");
  const twoKey = `${parts[0]}-${parts[1]}`;
  if (GROUP_META[twoKey])  return twoKey;
  if (KEY_ALIAS[twoKey])   return KEY_ALIAS[twoKey];
  const oneKey = parts[0];
  if (KEY_ALIAS[oneKey])   return KEY_ALIAS[oneKey];
  return oneKey;
}

function groupCategories(categories: Category[]): CategoryGroup[] {
  const map = new Map<string, Category[]>();
  for (const cat of categories) {
    const key = getGroupKey(cat.slug);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(cat);
  }
  const groups: CategoryGroup[] = [];
  for (const [key, cats] of map.entries()) {
    const meta = GROUP_META[key];
    groups.push({
      key,
      label:      meta?.label ?? key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      Icon:       meta?.Icon  ?? ShoppingBag,
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
  { Icon: Truck,       label: "Gratis Ongkir",        sub: "Min. belanja 50rb"    },
  { Icon: ShieldCheck, label: "Garansi Uang Kembali",  sub: "7 hari retur"         },
  { Icon: Zap,         label: "Same Day Delivery",     sub: "Order sebelum jam 12" },
];

// =================================================================
// PAGE
// =================================================================

export default function HomePage() {
  const { data: products,   isLoading: loadingProducts   } = useBestsellers();
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { isAuthenticated } = useAuth();

  const groups = categories ? groupCategories(categories) : [];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 flex flex-col gap-0">

        {/* ── Hero ────────────────────────────────────────────── */}
        {/*
          Gradient directional biar tidak flat. Dua decorative circle
          di sudut — ukurannya disproporsional supaya tidak simetris
          dan tidak keliatan template.
        */}
        <section
          className="relative overflow-hidden text-white"
          style={{ background: "linear-gradient(135deg, #7132f5 0%, #5018c8 70%, #3a0fa3 100%)" }}
        >
          {/* Decorative circles — intentionally asymmetric */}
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/[0.06] pointer-events-none" />
          <div className="absolute -bottom-12 right-32 w-48 h-48 rounded-full bg-white/[0.04] pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
            <div className="max-w-xl">
              <p className="text-white/45 text-[11px] font-semibold mb-4 tracking-[0.18em] uppercase">
                Marketplace Indonesia
              </p>
              <h1 className="text-[2.6rem] md:text-[3.25rem] font-bold leading-[1.1] mb-5 tracking-[-0.03em]">
                50.000 Produk,<br />
                Satu Platform
              </h1>
              <p className="text-white/60 text-base md:text-lg mb-8 leading-relaxed">
                Produk pilihan dari berbagai kategori, siap dikirim ke seluruh Indonesia.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Button
                  size="lg"
                  className="bg-white text-[#7132f5] hover:bg-white/90 font-semibold h-11 px-6 shadow-none"
                  asChild
                >
                  <Link href={ROUTES.PRODUCTS}>
                    Mulai Belanja <ShoppingBag className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
                {!isAuthenticated && (
                  <Button
                    size="lg"
                    className="bg-white/10 text-white hover:bg-white/15 border border-white/20 h-11 px-6 shadow-none"
                    asChild
                  >
                    <Link href={ROUTES.REGISTER}>Daftar Gratis</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────── */}
        <section className="bg-white border-b border-[#ebebeb]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-stretch divide-x divide-[#ebebeb]">
              {TRUST_ITEMS.map(({ Icon, label, sub }, i) => (
                <div key={i} className="flex-1 flex items-center justify-center gap-3 py-3.5 px-3">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0 hidden sm:block" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#111] hidden sm:block">{label}</p>
                    <p className="text-[11px] text-[#999] hidden sm:block">{sub}</p>
                    <p className="text-[11px] font-medium text-[#555] sm:hidden">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Kategori ────────────────────────────────────────── */}
        <section className="bg-white border-b border-[#ebebeb]">
          <div className="max-w-7xl mx-auto px-4 py-5 w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-[#111]">Kategori</h2>
              <Link
                href={ROUTES.PRODUCTS}
                className="text-[12px] text-primary flex items-center gap-1 hover:underline font-medium"
              >
                Semua <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto pb-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2 px-1 min-w-max">
                {/* "Semua" pill */}
                <Link
                  href={ROUTES.PRODUCTS}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#e8e8e8] bg-white hover:border-primary/40 hover:bg-primary/[0.04] transition-colors flex-shrink-0 group"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#999] group-hover:text-primary transition-colors" />
                  <span className="text-[12px] font-medium text-[#333] group-hover:text-primary whitespace-nowrap transition-colors">
                    Semua
                  </span>
                </Link>

                {/* Skeleton */}
                {loadingCategories && Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="h-8 w-28 rounded-full bg-[#f0f0f0] animate-pulse flex-shrink-0" />
                ))}

                {/* Group pills */}
                {!loadingCategories && groups.map(group => {
                  const firstId = group.categories[0]?.id;
                  const href    = firstId ? `${ROUTES.PRODUCTS}?categoryId=${firstId}` : ROUTES.PRODUCTS;
                  return (
                    <Link
                      key={group.key}
                      href={href}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#e8e8e8] bg-white hover:border-primary/40 hover:bg-primary/[0.04] transition-colors flex-shrink-0 group"
                    >
                      <group.Icon className="w-3.5 h-3.5 text-[#aaa] group-hover:text-primary transition-colors flex-shrink-0" />
                      <span className="text-[12px] font-medium text-[#333] group-hover:text-primary whitespace-nowrap transition-colors">
                        {group.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Promo Banner ────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-4 pt-8 w-full">
          <div
            className="relative overflow-hidden rounded-[10px] text-white px-8 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            style={{ background: "linear-gradient(115deg, #5018c8 0%, #7132f5 55%, #9555f8 100%)" }}
          >
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/[0.07] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5 opacity-50" />
                <p className="text-[11px] font-semibold opacity-50 tracking-widest uppercase">Promo Hari Ini</p>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-1 tracking-tight">Diskon s/d 75%</h3>
              <p className="text-white/55 text-sm">Belanja sekarang dan hemat lebih banyak</p>
            </div>
            <Button
              size="lg"
              className="relative bg-white text-[#7132f5] hover:bg-white/90 font-semibold flex-shrink-0 h-10 shadow-none"
              asChild
            >
              <Link href={`${ROUTES.PRODUCTS}?sortBy=soldCount&sortOrder=desc`}>
                Lihat Promo
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Produk Terlaris ─────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-center justify-between mb-5">
            <div>
              {/* Accent bar kiri — penanda section yang terasa crafted */}
              <div className="flex items-center gap-2.5 mb-0.5">
                <span className="w-[3px] h-5 rounded-full bg-primary flex-shrink-0" />
                <h2 className="text-xl font-bold">Produk Terlaris</h2>
              </div>
              <p className="text-sm text-[#999] pl-[19px]">Pilihan terpopuler dari pembeli Zenit</p>
            </div>
            <Link
              href={`${ROUTES.PRODUCTS}?sortBy=soldCount&sortOrder=desc`}
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {loadingProducts
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products?.map(p => <ProductCard key={p.id} product={p} />)
            }
          </div>
        </section>

        {/* ── CTA — hanya tampil jika belum login ─────────────── */}
        {!isAuthenticated && (
          <section className="relative overflow-hidden bg-[#0e0e12] text-white mt-4">
            {/* Dot grid — subtle texture yang tidak AI-ish karena tidak ada warna */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.10]"
              style={{
                backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative max-w-7xl mx-auto px-4 py-12 text-center">
              <p className="text-[11px] font-semibold text-white/30 tracking-[0.18em] uppercase mb-3">
                Mulai Hari Ini
              </p>
              <h2 className="text-2xl font-bold mb-2 tracking-tight">Bergabung dengan Zenit Sekarang</h2>
              <p className="text-[#666] mb-7 text-sm">Daftar gratis dan mulai belanja sekarang.</p>
              <Button
                size="lg"
                className="bg-white text-[#111] hover:bg-white/90 font-semibold h-11 px-8 shadow-none"
                asChild
              >
                <Link href={ROUTES.REGISTER}>Daftar Sekarang — Gratis</Link>
              </Button>
            </div>
          </section>
        )}

      </main>

      <Footer />
    </div>
  );
}