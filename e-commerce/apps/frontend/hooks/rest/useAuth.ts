"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "../../lib/api";
import { queryKeys } from "../../lib/queryClient";
import { ROUTES } from "../../lib/constants";
import type { User, LoginInput, RegisterInput } from "../../types";
import { toast } from "sonner";

export function useAuth() {
  const router = useRouter();
  const qc     = useQueryClient();

  // ── Get current user ────────────────────────────────────
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: queryKeys.auth.me,
    queryFn:  async () => {
      const res = await api.get<{ success: boolean; data: User }>("/auth/me");
      return res.data.data;
    },
    retry:     false,
    staleTime: 5 * 60 * 1000,
  });

  // ── Login ────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await api.post<{ success: boolean; data: User }>("/auth/login", input);
      return res.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.auth.me, data);
      toast.success(`Selamat datang, ${data.name}!`);
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      // [FIX] router.refresh() dulu — clear Next.js router cache supaya
      // middleware re-run dengan cookie baru. Tanpa ini, navigasi ke /cart
      // pakai cached redirect response dari sebelum login.
      router.refresh();
      router.push(from ?? (data.role === "ADMIN" ? "/admin/dashboard" : ROUTES.HOME));
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Register ─────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const res = await api.post<{ success: boolean; data: User }>("/auth/register", input);
      return res.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.auth.me, data);
      toast.success("Akun berhasil dibuat!");
      router.refresh();
      router.push(ROUTES.HOME);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Logout ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Tetap logout meski request gagal
    } finally {
      qc.clear();
      // [FIX] router.refresh() — clear cache supaya protected routes
      // tidak accessible setelah logout tanpa full page reload
      router.refresh();
      router.push(ROUTES.LOGIN);
    }
  }, [qc, router]);

  // ── changePassword ───────────────────────────────────────
  const changePasswordMutation = useMutation({
    mutationFn: async (_input: { oldPassword: string; newPassword: string }) => {
      const res = await api.patch<{ success: boolean }>("/auth/change-password", _input);
      return res.data.success;
    },
    onSuccess: () => {
      toast.success("Password berhasil diubah");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return {
    user,
    isLoading,
    isAuthenticated:         !!user,
    login:                   loginMutation.mutate,
    loginAsync:              loginMutation.mutateAsync,
    isLoginLoading:          loginMutation.isPending,
    register:                registerMutation.mutate,
    isRegisterLoading:       registerMutation.isPending,
    logout,
    changePassword:          changePasswordMutation.mutate,
    isChangePasswordLoading: changePasswordMutation.isPending,
  };
}