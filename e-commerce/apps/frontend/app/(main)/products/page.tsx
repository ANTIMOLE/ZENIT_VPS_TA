"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaa]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#f0f0f0]" />
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
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {params.q
              ? `Hasil pencarian: "${params.q}"`
              : params.categoryId
                ? (categories?.find(c => c.id === params.categoryId)?.name ?? "Produk")
                : "Semua Produk"
            }
          </h1>
          {result && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-[#999]">
                {result.totalCount.toLocaleString("id-ID")} produk ditemukan
              </p>
              {hasActiveFilter && (
                <>
                  <span className="w-1 h-1 rounded-full bg-[#ccc] inline-block" />
                  <span className="text-xs text-[#bbb]">{activeFilters.length} filter aktif</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5 transition-colors", hasActiveFilter && "border-primary text-primary")}
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
        <div className="flex flex-wrap gap-1.5 mb-4">
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

        {/* ── Sidebar Filter ──────────────────────────────────── */}
        {showFilters && (
          <aside className="w-56 flex-shrink-0 space-y-5 border-r border-[#f0f0f0] pr-5">

            {/* Search */}
            <div>
              <SidebarLabel>Cari Produk</SidebarLabel>
              <form onSubmit={handleSearch} className="flex gap-1.5">
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Nama produk..."
                  className="h-8 text-sm"
                />
                <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>

            {/* Kategori — scrollable, max 280px */}
            <div>
              <SidebarLabel>Kategori</SidebarLabel>
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#e0e0e0_transparent]">
                <button
                  onClick={() => setParam("categoryId", undefined)}
                  className={cn(
                    "w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors",
                    !params.categoryId
                      ? "bg-primary text-white font-medium"
                      : "hover:bg-[#f5f5f5] text-[#444]"
                  )}
                >
                  Semua Kategori
                </button>
                {loadingCats
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-7 bg-[#f0f0f0] rounded animate-pulse" />
                    ))
                  : categories?.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setParam("categoryId", cat.id)}
                        className={cn(
                          "w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors flex items-center justify-between",
                          params.categoryId === cat.id
                            ? "bg-primary text-white font-medium"
                            : "hover:bg-[#f5f5f5] text-[#444]"
                        )}
                      >
                        <span className="truncate">{cat.name}</span>
                        {cat.productCount !== undefined && (
                          <span className={cn(
                            "text-[11px] flex-shrink-0 ml-1",
                            params.categoryId === cat.id ? "text-white/70" : "text-[#bbb]"
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
            <div>
              <SidebarLabel>Rentang Harga</SidebarLabel>
              <div className="space-y-2">
                {/* Min price dengan prefix "Rp" */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#aaa] pointer-events-none select-none">
                    Rp
                  </span>
                  <Input
                    type="number"
                    placeholder="Minimum"
                    value={minPriceInput}
                    onChange={e => setMinPriceInput(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#aaa] pointer-events-none select-none">
                    Rp
                  </span>
                  <Input
                    type="number"
                    placeholder="Maksimum"
                    value={maxPriceInput}
                    onChange={e => setMaxPriceInput(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={applyPriceFilter}
                >
                  Terapkan
                </Button>
              </div>
            </div>

            {/* Rating */}
            <div>
              <SidebarLabel>Rating Minimum</SidebarLabel>
              <div className="space-y-0.5">
                {[null, 4, 3, 2].map(r => (
                  <button
                    key={r ?? "all"}
                    onClick={() => setParam("minRating", r ?? undefined)}
                    className={cn(
                      "w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors",
                      params.minRating === (r ?? undefined)
                        ? "bg-primary text-white font-medium"
                        : "hover:bg-[#f5f5f5] text-[#444]"
                    )}
                  >
                    {r ? `⭐ ${r}+` : "Semua Rating"}
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
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="h-8 w-48 bg-[#f0f0f0] rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-64 bg-[#f0f0f0] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}