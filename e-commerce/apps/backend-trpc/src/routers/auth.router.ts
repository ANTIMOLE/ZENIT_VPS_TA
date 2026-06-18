import { z }                  from "zod";
import { TRPCError }          from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc/init";
import { serviceCall }        from "../trpc/errors";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "@ecommerce/shared";
import * as authService from "../services/auth.service";
import type { Request } from "express";

// Cookie config — mirrors REST (auth.controller.ts COOKIE_OPTIONS)
const COOKIE_BASE = {
  httpOnly: true,
  secure:   false,
  sameSite: "lax" as const,
  path:     "/",
};

const ACCESS_COOKIE_OPTIONS  = { ...COOKIE_BASE, maxAge: 60 * 60 * 1000          }; // 1 jam
const REFRESH_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 }; // 7 hari

export const authRouter = router({

  // ── auth.me ──────────────────────────────────────────────
  me: protectedProcedure.query(async ({ ctx }) => {
    const result = await serviceCall(() => authService.getProfile(ctx.userId!));
    return result.user;
  }),

  // ── auth.register ─────────────────────────────────────────
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await serviceCall(() => authService.register(input));
      ctx.res.cookie("accessToken",  result.accessToken,  ACCESS_COOKIE_OPTIONS);
      ctx.res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
      return { user: result.user };
    }),

  // ── auth.login ────────────────────────────────────────────
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await serviceCall(() => authService.login(input));
      ctx.res.cookie("accessToken",  result.accessToken,  ACCESS_COOKIE_OPTIONS);
      ctx.res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
      return { user: result.user };
    }),

  // ── auth.logout ───────────────────────────────────────────
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await serviceCall(() => authService.logout(ctx.userId!));
    ctx.res.clearCookie("accessToken",  { path: "/" });
    ctx.res.clearCookie("refreshToken", { path: "/" });
    return { success: true };
  }),

  // ── auth.refresh ──────────────────────────────────────────
  // BUG SEBELUMNYA (sama dengan REST refreshTokenController):
  //   const accessToken = await serviceCall(() => authService.refreshToken(token))
  //   → authService.refreshToken() return { accessToken, refreshToken }
  //   → seluruh object di-set sebagai cookie "accessToken"
  //   → jwt.verify("[object Object]") di middleware → 401
  //   → semua request berikutnya (logout, me) gagal
  //
  // FIX: destructure result, set KEDUA cookie (accessToken + refreshToken baru).
  // refreshToken baru wajib di-set karena token rotation di authService
  // sudah revoke refreshToken lama — kalau tidak di-update di cookie,
  // request refresh berikutnya kirim token yang sudah invalid → 401.
  refresh: publicProcedure
    .mutation(async ({ ctx }) => {
      const req   = ctx.res.req as Request;
      const token = req.cookies?.refreshToken as string | undefined;

      if (!token) {
        throw new TRPCError({
          code:    "UNAUTHORIZED",
          message: "Refresh token tidak ditemukan.",
        });
      }

      // FIX: destructure — jangan assign object ke satu variable
      const { accessToken, refreshToken: newRefreshToken } =
        await serviceCall(() => authService.refreshToken(token));

      // Set accessToken cookie baru
      ctx.res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS);

      // FIX: set refreshToken cookie baru — token lama sudah di-revoke
      // oleh rotation di authService.refreshToken()
      ctx.res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);

      return { success: true };
    }),

  // ── auth.changePassword ───────────────────────────────────
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      return serviceCall(() =>
        authService.changePassword(ctx.userId!, input.oldPassword, input.newPassword)
      );
    }),
});