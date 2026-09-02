"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/ProductCard";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { useProductList } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { SORT_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProductListParams } from "@/types";

function parseNumParam(s: string | null | undefined): number | undefined {
  if (s === null || s === undefined || s.trim() === "") return undefined;
  const n = Number(s);
  return isNaN(n) ? undefined : n;
}

// ── Sidebar section header ─────────────────────────────────────
// Thin line + small-caps label. Lebih terstruktur dari bold text biasa.
function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        {children}
      </span>
      <div className="flex-1 h-px bg-zinc-200" />
    </div>
  );
}

function ProductsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const [params, setParams] = useState<ProductListParams>({
    page:       Number(searchParams.get("page"))       || 1,
    limit:      DEFAULT_PAGE_SIZE,
    categoryId: searchParams.get("categoryId")         || undefined,
    q:          searchParams.get("q")                  || undefined,
    minPrice:   parseNumParam(searchParams.get("minPrice")),
    maxPrice:   parseNumParam(searchParams.get("maxPrice")),
    minRating:  parseNumParam(searchParams.get("minRating")),
    sortBy:     (searchParams.get("sortBy") as ProductListParams["sortBy"]) || "createdAt",
    sortOrder:  (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
  });

  const [searchInput,   setSearchInput]   = useState(params.q ?? "");
  const [minPriceInput, setMinPriceInput] = useState(params.minPrice?.toString() ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(params.maxPrice?.toString() ?? "");

  const { data: result,     isLoading }          = useProductList(params);
  const { data: categories, isLoading: loadingCats } = useCategories();

  useEffect(() => {
    const p = new URLSearchParams();
    if (params.page && params.page > 1)  p.set("page",       String(params.page));
    if (params.categoryId)               p.set("categoryId", params.categoryId);
    if (params.q)                        p.set("q",          params.q);
    if (params.minPrice != null)         p.set("minPrice",   String(params.minPrice));
    if (params.maxPrice != null)         p.set("maxPrice",   String(params.maxPrice));
    if (params.minRating != null)        p.set("minRating",  String(params.minRating));
    if (params.sortBy && params.sortBy !== "createdAt")   p.set("sortBy",    params.sortBy);
    if (params.sortOrder && params.sortOrder !== "desc")  p.set("sortOrder", params.sortOrder);
    router.replace(`/products${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  }, [params, router]);

  function setParam<K extends keyof ProductListParams>(key: K, value: ProductListParams[K]) {
    setParams(prev => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", searchInput.trim() || undefined);
  }

  function applyPriceFilter() {
    setParams(prev => ({
      ...prev,
      minPrice: parseNumParam(minPriceInput),
      maxPrice: parseNumParam(maxPriceInput),
      page: 1,
    }));
  }

  function clearAllFilters() {
    setParams({ page: 1, limit: DEFAULT_PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" });
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
  }

  function handleSortChange(value: string) {
    const [sortBy, sortOrder] = value.split(":") as [ProductListParams["sortBy"], "asc" | "desc"];
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  }

  const sortValue     = `${params.sortBy ?? "createdAt"}:${params.sortOrder ?? "desc"}`;
  const activeFilters = [
    params.categoryId && categories?.find(c => c.id === params.categoryId)?.name,
    params.q          && `"${params.q}"`,
    (params.minPrice != null || params.maxPrice != null) &&
      `Rp ${params.minPrice?.toLocaleString("id-ID") ?? "0"} – ${params.maxPrice?.toLocaleString("id-ID") ?? "∞"}`,
    params.minRating != null && `⭐ ${params.minRating}+`,
  ].filter(Boolean) as string[];

  const hasActiveFilter = activeFilters.length > 0;

  return (
    // Same call as the product detail page: this route opts out of the
    // site-wide ShiftBackground. A grid this dense needs a calm, neutral
    // canvas — the animated color wash was fighting the product photos and
    // washing out the light gray text/borders this page was built with.
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-900">
              {params.q
                ? `Hasil pencarian: "${params.q}"`
                : params.categoryId
                  ? (categories?.find(c => c.id === params.categoryId)?.name ?? "Produk")
                  : "Semua Produk"
              }
            </h1>
            {result && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-zinc-500">
                  {result.totalCount.toLocaleString("id-ID")} produk ditemukan
                </p>
                {hasActiveFilter && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
                    <span className="text-xs text-zinc-400">{activeFilters.length} filter aktif</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* "Tool" cluster — this is the one place on the page that gets
              the glass treatment, and it's the restrained version: mostly
              solid white with a thin blur, not a tinted/translucent panel. */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm">
            <Select value={sortValue} onValueChange={handleSortChange}>
              <SelectTrigger className="w-44 h-9 text-sm border-0 bg-transparent shadow-none">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-5 w-px bg-zinc-200" />

            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 transition-colors", hasActiveFilter && "text-primary")}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
              {hasActiveFilter && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-primary/10 text-primary border-0">
                  {activeFilters.length}
                </Badge>
              )}
              <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
            </Button>
          </div>
        </div>

        {/* ── Active filter chips ─────────────────────────────── */}
        {hasActiveFilter && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {activeFilters.map((f, i) => (
              <Badge
                key={i}
                variant="secondary"
                className={cn(
                  "gap-1 pl-2.5 pr-2 py-1 text-xs rounded-full border font-normal",
                  f.startsWith('"')  && "bg-blue-50 text-blue-700 border-blue-200",
                  f.startsWith("Rp") && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  f.startsWith("⭐") && "bg-amber-50 text-amber-700 border-amber-200",
                  !f.startsWith('"') && !f.startsWith("Rp") && !f.startsWith("⭐") &&
                    "bg-violet-50 text-violet-700 border-violet-200"
                )}
              >
                {f}
              </Badge>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs text-red-500 hover:underline flex items-center gap-0.5 px-1"
            >
              <X className="w-3 h-3" /> Hapus semua
            </button>
          </div>
        )}

        <div className="flex gap-6">

          {/* ── Sidebar Filter — was a bare list with a border-right;
              now a proper self-contained panel with grouped sub-sections,
              still in the same restrained/high-opacity glass as the
              toolbar above. ──────────────────────────────────── */}
          {showFilters && (
            <aside className="w-64 flex-shrink-0 space-y-5 rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm">

              {/* Search */}
              <div>
                <SidebarLabel>Cari Produk</SidebarLabel>
                <form onSubmit={handleSearch} className="flex gap-1.5">
                  <Input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Nama produk..."
                    className="h-8 text-sm bg-white"
                  />
                  <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </div>

              {/* Kategori — scrollable, max 280px */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2.5">
                <SidebarLabel>Kategori</SidebarLabel>
                <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent]">
                  <button
                    onClick={() => setParam("categoryId", undefined)}
                    className={cn(
                      "w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors",
                      !params.categoryId
                        ? "bg-primary text-white font-medium shadow-sm"
                        : "hover:bg-white text-zinc-600"
                    )}
                  >
                    Semua Kategori
                  </button>
                  {loadingCats
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-7 bg-zinc-100 rounded-lg animate-pulse" />
                      ))
                    : categories?.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setParam("categoryId", cat.id)}
                          className={cn(
                            "w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between",
                            params.categoryId === cat.id
                              ? "bg-primary text-white font-medium shadow-sm"
                              : "hover:bg-white text-zinc-600"
                          )}
                        >
                          <span className="truncate">{cat.name}</span>
                          {cat.productCount !== undefined && (
                            <span className={cn(
                              "text-[11px] flex-shrink-0 ml-1",
                              params.categoryId === cat.id ? "text-white/70" : "text-zinc-400"
                            )}>
                              {cat.productCount}
                            </span>
                          )}
                        </button>
                      ))
                  }
                </div>
              </div>

              {/* Harga */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2.5">
                <SidebarLabel>Rentang Harga</SidebarLabel>
                <div className="space-y-2">
                  {/* Min price dengan prefix "Rp" */}
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none select-none">
                      Rp
                    </span>
                    <Input
                      type="number"
                      placeholder="Minimum"
                      value={minPriceInput}
                      onChange={e => setMinPriceInput(e.target.value)}
                      className="h-8 text-sm pl-8 bg-white"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none select-none">
                      Rp
                    </span>
                    <Input
                      type="number"
                      placeholder="Maksimum"
                      value={maxPriceInput}
                      onChange={e => setMaxPriceInput(e.target.value)}
                      className="h-8 text-sm pl-8 bg-white"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs bg-white"
                    onClick={applyPriceFilter}
                  >
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Rating */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2.5">
                <SidebarLabel>Rating Minimum</SidebarLabel>
                <div className="space-y-0.5">
                  {[null, 4, 3, 2].map(r => (
                    <button
                      key={r ?? "all"}
                      onClick={() => setParam("minRating", r ?? undefined)}
                      className={cn(
                        "w-full flex items-center gap-1.5 text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors",
                        params.minRating === (r ?? undefined)
                          ? "bg-primary text-white font-medium shadow-sm"
                          : "hover:bg-white text-zinc-600"
                      )}
                    >
                      {r ? (
                        <>
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              params.minRating === r ? "fill-white text-white" : "fill-yellow-400 text-yellow-400"
                            )}
                          />
                          {r}+
                        </>
                      ) : (
                        "Semua Rating"
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </aside>
          )}

          {/* ── Product Grid ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className={cn(
                "grid gap-4",
                showFilters
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
              )}>
                {Array.from({ length: DEFAULT_PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : !result?.data?.length ? (
              <EmptyState
                emoji="🔍"
                title="Produk tidak ditemukan"
                description="Coba ubah kata kunci atau filter pencarian kamu."
                action={{ label: "Reset Filter", onClick: clearAllFilters }}
              />
            ) : (
              <>
                <div className={cn(
                  "grid gap-4",
                  showFilters
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                )}>
                  {result.data.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {result.totalPages > 1 && (
                  <Pagination
                    className="mt-8"
                    currentPage={params.page ?? 1}
                    totalPages={result.totalPages}
                    onPageChange={page => setParams(prev => ({ ...prev, page }))}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-64 bg-zinc-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}