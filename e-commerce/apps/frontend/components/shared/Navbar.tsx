"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, User, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`${ROUTES.PRODUCTS}?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#ebebeb]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 h-[58px]">

          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex-shrink-0">
            <Image
              src="/zenit-logo.svg"
              alt="Zenit"
              width={96}
              height={30}
              priority
            />
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a0a0]" />
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Cari produk di Zenit..."
                className="pl-9 pr-4 h-9 bg-[#f5f5f5] border-transparent focus:border-primary focus:bg-white text-sm rounded-lg transition-colors"
              />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">

            {/* [FIX] prefetch=false — cegah Next.js cache redirect response
                dari middleware sebelum user login. Tanpa ini, klik cart setelah
                login masih pakai cached redirect ke /login. */}
            <Link href={ROUTES.CART} prefetch={false}>
              <Button variant="ghost" size="icon" className="relative w-9 h-9">
                <ShoppingCart className="w-[18px] h-[18px]" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-9 h-9">
                    <User className="w-[18px] h-[18px]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {/* [FIX] prefetch=false pada semua protected links di dropdown */}
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.ORDERS} prefetch={false}>Pesanan Saya</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.PROFILE} prefetch={false}>Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500"
                    onClick={logout}
                  >
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2 ml-1">
                <Button variant="ghost" size="sm" className="h-8 px-3 text-sm font-medium" asChild>
                  <Link href={ROUTES.LOGIN}>Masuk</Link>
                </Button>
                <Button size="sm" className="h-8 px-3 text-sm font-medium" asChild>
                  <Link href={ROUTES.REGISTER}>Daftar</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden w-9 h-9"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={handleSearch} className="pb-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a0a0]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="pl-9 h-9 bg-[#f5f5f5] border-transparent text-sm rounded-lg"
            />
          </div>
        </form>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#ebebeb] bg-white px-4 py-3 flex flex-col gap-1.5">
          {!isAuthenticated && (
            <>
              <Button asChild className="w-full h-9 text-sm">
                <Link href={ROUTES.LOGIN}>Masuk</Link>
              </Button>
              <Button variant="outline" asChild className="w-full h-9 text-sm">
                <Link href={ROUTES.REGISTER}>Daftar</Link>
              </Button>
            </>
          )}
          {/* [FIX] prefetch=false pada protected links di mobile drawer */}
          <Link href={ROUTES.ORDERS} prefetch={false} className="py-2 text-sm text-foreground/70 hover:text-foreground">Pesanan</Link>
          <Link href={ROUTES.PROFILE} prefetch={false} className="py-2 text-sm text-foreground/70 hover:text-foreground">Profil</Link>
        </div>
      )}
    </header>
  );
}