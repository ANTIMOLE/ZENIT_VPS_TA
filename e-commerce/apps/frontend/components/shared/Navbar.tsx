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
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-5 h-14 md:h-[60px]">
          
          {/* Logo */}
          <Link 
            href={ROUTES.HOME} 
            className="flex-shrink-0 transition-opacity hover:opacity-80 active:opacity-70"
          >
            <Image
              src="/zenit-logo.svg"
              alt="Zenit"
              width={96}
              height={30}
              priority
              className="h-7 w-auto"
            />
          </Link>

          {/* Search bar - Desktop */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex">
            <div className="relative w-full group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within:text-foreground transition-colors" />
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Cari produk di Zenit..."
                className="pl-10 pr-4 h-10 bg-black/[0.04] border-transparent hover:bg-black/[0.06] focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 text-sm rounded-full transition-all duration-200 placeholder:text-muted-foreground/60"
              />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
            
            {/* Cart */}
            <Link href={ROUTES.CART} prefetch={false}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative w-10 h-10 rounded-full hover:bg-black/[0.06] active:bg-black/[0.09] transition-colors"
              >
                <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={1.75} />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1 leading-none shadow-sm ring-2 ring-white">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-10 h-10 rounded-full hover:bg-black/[0.06] active:bg-black/[0.09] transition-colors"
                  >
                    <User className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 rounded-xl border-black/5 shadow-lg shadow-black/5"
                >
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-black/5" />
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                    <Link href={ROUTES.ORDERS} prefetch={false}>Pesanan Saya</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                    <Link href={ROUTES.PROFILE} prefetch={false}>Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/5" />
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500 focus:bg-red-50 rounded-lg cursor-pointer"
                    onClick={logout}
                  >
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2 ml-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 px-4 text-sm font-medium rounded-full hover:bg-black/[0.06]" 
                  asChild
                >
                  <Link href={ROUTES.LOGIN}>Masuk</Link>
                </Button>
                <Button 
                  size="sm" 
                  className="h-9 px-4 text-sm font-medium rounded-full shadow-sm" 
                  asChild
                >
                  <Link href={ROUTES.REGISTER}>Daftar</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden w-10 h-10 rounded-full hover:bg-black/[0.06] active:bg-black/[0.09]"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <Menu className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={handleSearch} className="pb-3.5 md:hidden">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within:text-foreground transition-colors" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="pl-10 h-10 bg-black/[0.04] border-transparent focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 text-sm rounded-full transition-all duration-200 placeholder:text-muted-foreground/60"
            />
          </div>
        </form>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-black/5 bg-white/80 backdrop-blur-xl px-4 py-4 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
          {!isAuthenticated && (
            <div className="flex flex-col gap-2 mb-1">
              <Button asChild className="w-full h-10 text-sm rounded-full font-medium">
                <Link href={ROUTES.LOGIN}>Masuk</Link>
              </Button>
              <Button variant="outline" asChild className="w-full h-10 text-sm rounded-full font-medium border-black/10">
                <Link href={ROUTES.REGISTER}>Daftar</Link>
              </Button>
            </div>
          )}
          
          <div className="flex flex-col">
            <Link 
              href={ROUTES.ORDERS} 
              prefetch={false} 
              className="py-2.5 px-1 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Pesanan
            </Link>
            <Link 
              href={ROUTES.PROFILE} 
              prefetch={false} 
              className="py-2.5 px-1 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Profil
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}