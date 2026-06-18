"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart,
  Users, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Nav items ─────────────────────────────────────────────────
const NAV = [
  {
    label: "Dashboard",
    href:  "/admin/dashboard",
    icon:  <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: "Produk",
    href:  "/admin/products",
    icon:  <Package className="w-4 h-4" />,
  },
  {
    label: "Pesanan",
    href:  "/admin/orders",
    icon:  <ShoppingCart className="w-4 h-4" />,
  },
  {
    label: "Pengguna",
    href:  "/admin/users",
    icon:  <Users className="w-4 h-4" />,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Guard: redirect jika bukan ADMIN ──────────────────────
  useEffect(() => {
    if (isLoading) return;
    // User tidak login → ke login
    if (!user) {
      router.replace("/login?from=" + pathname);
      return;
    }
    // User login tapi bukan ADMIN → ke home
    if (user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [user, isLoading, router, pathname]);

  // Loading saat cek auth
  if (isLoading || !user || user.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-32 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#fafaf9]">

      {/* ── Mobile overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-[#ebebeb] flex flex-col transition-transform duration-200",
        "md:translate-x-0 md:static md:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-[58px] px-5 border-b border-[#ebebeb] flex-shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Image
              src="/zenit-logo.svg"
              alt="Zenit Admin"
              width={72}
              height={22}
              priority
            />
            <span className="text-[10px] font-bold text-[#bbb] uppercase tracking-widest">
              Admin
            </span>
          </Link>
          <button
            className="md:hidden text-[#aaa] hover:text-[#555]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary/8 text-primary border-l-2 border-primary pl-[10px]"
                    : "text-[#666] hover:bg-[#f5f5f5] hover:text-[#111]"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-3 border-t border-[#ebebeb] flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-bold text-primary flex-shrink-0">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{user.name}</p>
              <p className="text-[11px] text-[#aaa] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] font-medium text-[#999] hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile topbar */}
        <header className="md:hidden h-[58px] bg-white border-b border-[#ebebeb] px-4 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#888] hover:text-[#333]"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <span className="font-semibold text-[13px]">Admin Panel</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>

    </div>
  );
}