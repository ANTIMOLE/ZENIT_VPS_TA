"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck, Mail, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { RecaptchaWidget } from "@/components/shared/RecaptchaWidget";
import { SocialAuthButtons } from "@/components/shared/SocialAuthButtons";
import { cn } from "@/lib/utils";

// ── Validation Schema ─────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password tidak boleh kosong"),
});
type LoginForm = z.infer<typeof loginSchema>;

// ── Animation variants — same easing/stagger as the register page so the
// two feel like one product instead of two separately-built screens.
const EASE_OUT_QUART: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: EASE_OUT_QUART,
    },
  },
};

// ── Login Page ────────────────────────────────────────────────
export default function LoginPage() {
  const { login, isLoginLoading } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [captchaDone, setCaptchaDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  function onSubmit(data: LoginForm) {
    if (!captchaDone) return;
    // captchaToken dikirim ke backend untuk verifikasi server-side
    login({ ...data, ...(captchaToken && { captchaToken }) });
  }

  return (
    <div className="relative flex w-full items-center justify-center px-4 py-3">
      {/* Same glass card treatment as the register page: logo + heading
          inside the card, blue-tinted translucent glass, two nested panels. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[900px] overflow-hidden rounded-[28px] border border-sky-100/50 bg-sky-50/25 shadow-[0_25px_70px_-20px_rgba(56,80,180,0.3)] backdrop-blur-2xl"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative p-5 sm:p-6">
          {/* Logo doubles as a link home — no separate page header */}
          <div className="mb-3 flex justify-center">
            <Link href="/" className="inline-flex items-center transition hover:opacity-80">
              <Image src="/zenit-logo.svg" alt="Zenit" width={84} height={26} />
            </Link>
          </div>

          <div className="mb-4 text-center">
            <h1 className="text-[1.5rem] font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">
              Masuk ke Zenit
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 transition hover:underline"
              >
                Daftar gratis
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr] md:items-stretch">
            {/* LEFT — quick methods */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-sky-100/50 bg-sky-50/30 p-5 backdrop-blur-md"
            >
              <p className="mb-4 text-[13px] font-medium text-zinc-600">
                Masuk cepat pakai akun lain
              </p>

              <div className="relative">
                <SocialAuthButtons mode="login" />
              </div>

              <p className="relative mt-auto pt-6 text-[12.5px] leading-relaxed text-zinc-600">
                Gunakan akun yang sama dengan yang kamu pakai waktu daftar.
              </p>
            </motion.div>

            {/* RIGHT — manual form */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-sky-100/50 bg-white/35 backdrop-blur-md"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-primary to-sky-400/70" />

              <div className="p-5 pt-6 sm:p-6 sm:pt-7">
                <div className="mb-4 flex items-center gap-3">
                  <Separator className="flex-1 bg-sky-100/60" />
                  <span className="text-xs text-zinc-500">atau masuk dengan email</span>
                  <Separator className="flex-1 bg-sky-100/60" />
                </div>

                <motion.form
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-3.5"
                >
                  {/* Email */}
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nama@email.com"
                        autoComplete="email"
                        {...register("email")}
                        className={cn(
                          "h-11 bg-white/80 pl-10 transition-all",
                          errors.email
                            ? "border-red-400 focus-visible:ring-red-400/30"
                            : "focus-visible:ring-primary/20"
                        )}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </motion.div>

                  {/* Password */}
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                        Password
                      </Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Lupa password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="password"
                        type={showPass ? "text" : "password"}
                        placeholder="Masukkan password"
                        autoComplete="current-password"
                        {...register("password")}
                        className={cn(
                          "h-11 bg-white/80 pl-10 pr-11 transition-all",
                          errors.password
                            ? "border-red-400 focus-visible:ring-red-400/30"
                            : "focus-visible:ring-primary/20"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
                        tabIndex={-1}
                      >
                        {showPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-500">{errors.password.message}</p>
                    )}
                  </motion.div>

                  {/* reCAPTCHA */}
                  <motion.div variants={itemVariants} className="pt-1">
                    <RecaptchaWidget
                      onVerify={(token) => {
                        setCaptchaDone(true);
                        setCaptchaToken(token);
                      }}
                      onExpire={() => {
                        setCaptchaDone(false);
                        setCaptchaToken(null);
                      }}
                    />
                  </motion.div>

                  {/* Submit */}
                  <motion.div variants={itemVariants}>
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 w-full text-[15px] font-semibold shadow-sm transition-all hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
                      disabled={isLoginLoading || !captchaDone}
                    >
                      {isLoginLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        "Masuk"
                      )}
                    </Button>
                  </motion.div>
                </motion.form>

                {/* Footer trust */}
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dilindungi reCAPTCHA · Privasi &amp; Syarat berlaku
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}