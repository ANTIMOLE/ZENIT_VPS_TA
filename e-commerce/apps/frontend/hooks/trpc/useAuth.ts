"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { ROUTES } from "@/lib/constants";
import { toast } from "sonner";

export function useAuth() {
  const router = useRouter();
  const utils  = trpc.useUtils();

  const { data: user, isLoading, isError } = trpc.auth.me.useQuery(undefined, {
    retry:     false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // setData writes the confirmed user (with role) into the cache
      // synchronously. invalidate() only *schedules* a background refetch —
      // it was possible for router.push() below to land on /admin/dashboard
      // before that refetch resolved, so the admin layout's role guard
      // still saw no user yet and bounced to the normal user flow. This is
      // almost certainly the intermittent redirect bug.
      utils.auth.me.setData(undefined, data.user);
      toast.success(`Selamat datang, ${data.user.name}!`);
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      // No router.refresh() — there's no middleware.ts in this project to
      // re-run, and calling it right before push() only added a race
      // window in the App Router navigation.
      router.push(from ?? (data.user.role === "ADMIN" ? "/admin/dashboard" : ROUTES.HOME));
    },
    onError: (err) => toast.error(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
      toast.success("Akun berhasil dibuat!");
      router.push(ROUTES.HOME);
    },
    onError: (err) => toast.error(err.message),
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSettled: () => {
      void utils.invalidate();
      router.push(ROUTES.LOGIN);
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => toast.success("Password berhasil diubah"),
    onError:   (err) => toast.error(err.message),
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