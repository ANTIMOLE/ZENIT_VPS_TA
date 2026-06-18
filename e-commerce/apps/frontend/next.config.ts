import type { NextConfig } from "next";
import path from "path";

// ============================================================
// API_MODE switching via webpack alias
//
// Build for REST:  NEXT_PUBLIC_API_MODE=rest  pnpm build
// Build for tRPC:  NEXT_PUBLIC_API_MODE=trpc  pnpm build
// ============================================================

const apiMode = process.env.NEXT_PUBLIC_API_MODE ?? "rest";
const isTRPC  = apiMode === "trpc";

// ── Backend URLs (server-side only, safe to use in rewrites) ──
// These are never exposed to the browser. Set them in .env:
//   BACKEND_REST_URL=http://localhost:4000
//   BACKEND_TRPC_URL=http://localhost:4001
const BACKEND_REST = process.env.BACKEND_REST_URL ?? "http://localhost:4000";
const BACKEND_TRPC = process.env.BACKEND_TRPC_URL ?? "http://localhost:4001";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      {
        protocol: "https",
        hostname: "images.tokopedia.net",
        pathname: "/img/**",
      },
      {
        protocol: "https",
        hostname: "**.tokopedia-static.net",
      },
      {
        protocol: "https",
        hostname: "tokopedia-static.net",
      },
    ],
  },

  // ── API Proxy Rewrites ────────────────────────────────────
  // Browser makes same-origin requests to /api/v1/* and /trpc/*
  // Next.js server-side proxies to the backend ports.
  //
  // WHY: Cookies dari backend port 4000 tidak bisa di-set di browser
  // karena cross-origin (port 80 ≠ port 4000) tanpa HTTPS + SameSite=None.
  // Dengan proxy ini, semua request jadi same-origin → cookie bekerja normal.
  //
  // K6 tests tidak terpengaruh — K6 tetap langsung hit port 4000.
  async rewrites() {
    return [
      {
        source:      "/api/v1/:path*",
        destination: `${BACKEND_REST}/api/v1/:path*`,
      },
      {
        source:      "/trpc/:path*",
        destination: `${BACKEND_TRPC}/trpc/:path*`,
      },
    ];
  },

  turbopack: {
    resolveAlias: isTRPC ? {
      "@/hooks/useAuth":       "./hooks/trpc/useAuth.ts",
      "@/hooks/useCart":       "./hooks/trpc/useCart.ts",
      "@/hooks/useCheckout":   "./hooks/trpc/useCheckout.ts",
      "@/hooks/useOrders":     "./hooks/trpc/useOrders.ts",
      "@/hooks/useProducts":   "./hooks/trpc/useProducts.ts",
      "@/hooks/useProfile":    "./hooks/trpc/useProfile.ts",
      "@/hooks/useCategories": "./hooks/trpc/useCategories.ts",
      "@/hooks/useAdmin":      "./hooks/trpc/useAdmin.ts",
    } : {},
  },

  webpack(config) {
    if (isTRPC) {
      const hooks = [
        "useAuth", "useCart", "useCheckout", "useOrders",
        "useProducts", "useProfile", "useCategories", "useAdmin",
      ];
      hooks.forEach((hook) => {
        config.resolve.alias[`@/hooks/${hook}`] = path.resolve(
          __dirname, `hooks/trpc/${hook}.ts`
        );
      });
    }
    return config;
  },
};

export default nextConfig;