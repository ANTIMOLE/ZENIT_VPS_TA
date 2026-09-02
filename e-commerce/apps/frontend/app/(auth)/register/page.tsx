"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Check,
  X,
  User,
  Mail,
  Lock,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
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

const registerSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter"),
    email: z.string().email("Format email tidak valid"),
    password: z
      .string()
      .min(8, "Minimal 8 karakter")
      .regex(/[A-Z]/, "Harus ada huruf besar")
      .regex(/[a-z]/, "Harus ada huruf kecil")
      .regex(/[0-9]/, "Harus ada angka"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

// The animated purple/blue background lives in layout.tsx as
// <ShiftBackground /> — mounted once for the whole (auth) section, portals
// into document.body — so there's nothing to render here for it.

// ── Confetti particles ─────────────────────────────────────────
const CONFETTI_COLORS = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

type ConfettiParticle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  heightRatio: number;
};

function generateConfettiParticles(): ConfettiParticle[] {
  return Array.from({ length: 48 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2.2 + Math.random() * 1.4,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 720 - 360,
    heightRatio: 0.6 + Math.random() * 0.8,
  }));
}

function Confetti() {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(generateConfettiParticles());
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            y: -20,
            x: `${p.left}vw`,
            opacity: 1,
            scale: 1,
            rotate: 0,
          }}
          animate={{
            y: "110vh",
            opacity: [1, 1, 0],
            scale: [1, 1.1, 0.6],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeOut",
          }}
          className="absolute top-0 rounded-sm"
          style={{
            width: p.size,
            height: p.size * p.heightRatio,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

// ── Password strength ──────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "Minimal 8 karakter", ok: password.length >= 8 },
    { label: "Huruf besar", ok: /[A-Z]/.test(password) },
    { label: "Huruf kecil", ok: /[a-z]/.test(password) },
    { label: "Angka", ok: /[0-9]/.test(password) },
  ];

  const score = rules.filter((r) => r.ok).length;
  const strength =
    score === 0
      ? { label: "", color: "bg-transparent", width: "0%" }
      : score <= 1
        ? { label: "Lemah", color: "bg-red-500", width: "25%" }
        : score === 2
          ? { label: "Cukup", color: "bg-orange-400", width: "50%" }
          : score === 3
            ? { label: "Bagus", color: "bg-yellow-400", width: "75%" }
            : { label: "Kuat", color: "bg-emerald-500", width: "100%" };

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 space-y-2"
    >
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/40">
          <motion.div
            className={cn("h-full rounded-full", strength.color)}
            initial={{ width: 0 }}
            animate={{ width: strength.width }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>
        {strength.label && (
          <span className="min-w-[40px] text-right text-[11px] font-medium text-zinc-500">
            {strength.label}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map((r) => (
          <li
            key={r.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px] transition-colors duration-200",
              r.ok ? "text-emerald-600" : "text-zinc-500"
            )}
          >
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-full transition-all",
                r.ok ? "bg-emerald-100" : "bg-white/50"
              )}
            >
              {r.ok ? (
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              ) : (
                <X className="h-2.5 w-2.5" strokeWidth={2.5} />
              )}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ── Animation variants (content stagger only) ────────────────────────────
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

export default function RegisterPage() {
  const { register: registerUser, isRegisterLoading } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaDone, setCaptchaDone] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const passwordValue = watch("password", "");
  const confirmValue = watch("confirmPassword", "");
  const passwordsMatch =
    confirmValue.length > 0 && passwordValue === confirmValue;

  async function onSubmit(data: RegisterForm) {
    if (!captchaDone) return;

    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      setIsSuccess(true);
    } catch {
      // error handling is assumed to live inside useAuth
    }
  }

  // Auto-hide confetti after a few seconds
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => setIsSuccess(false), 4500);
    return () => clearTimeout(t);
  }, [isSuccess]);

  return (
    // No min-h-[100dvh] / heavy py here — the parent <main> in
    // (auth)/layout.tsx is already flex-1 + centered, so this only needs to
    // size to its own content.
    <div className="relative flex w-full items-center justify-center px-4 py-3">
      {/* Confetti on success */}
      <AnimatePresence>{isSuccess && <Confetti />}</AnimatePresence>

      {/* Success overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 260 }}
              className="mx-4 max-w-sm rounded-2xl border border-white/50 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <PartyPopper className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900">
                Selamat datang di Zenit!
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Akun kamu berhasil dibuat. Yuk mulai belanja.
              </p>
              <Button asChild className="mt-6 w-full" size="lg">
                <Link href="/">Mulai Jelajah</Link>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One glass card holds the logo, heading, and both panels. Tinted
          slightly toward blue (sky-50/100 instead of plain white) but kept
          low-opacity + backdrop-blur so the animated background color still
          reads through it. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[900px] overflow-hidden rounded-[28px] border border-sky-100/50 bg-sky-50/25 shadow-[0_25px_70px_-20px_rgba(56,80,180,0.3)] backdrop-blur-2xl"
      >
        {/* glass edge highlight + soft color glows, purely cosmetic */}
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
          {/* Logo instead of a page-level header — doubles as a link home */}
          <div className="mb-3 flex justify-center">
            <Link href="/" className="inline-flex items-center transition hover:opacity-80">
              <Image src="/zenit-logo.svg" alt="Zenit" width={84} height={26} />
            </Link>
          </div>

          <div className="mb-4 text-center">
            <h1 className="text-[1.5rem] font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">
              Buat akun Zenit
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 transition hover:underline"
              >
                Masuk di sini
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
                Daftar cepat pakai akun lain
              </p>

              <div className="relative">
                <SocialAuthButtons mode="register" />
              </div>

              <p className="relative mt-auto pt-6 text-[12.5px] leading-relaxed text-zinc-600">
                Prosesnya kurang dari semenit dan datamu langsung terenkripsi end-to-end.
              </p>
            </motion.div>

            {/* RIGHT — manual form */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-sky-100/50 bg-white/35 backdrop-blur-md"
            >
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-primary to-sky-400/70" />

              <div className="p-5 pt-6 sm:p-6 sm:pt-7">
                <div className="mb-4 flex items-center gap-3">
                  <Separator className="flex-1 bg-sky-100/60" />
                  <span className="text-xs text-zinc-500">atau daftar manual</span>
                  <Separator className="flex-1 bg-sky-100/60" />
                </div>

                <motion.form
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-3.5"
                >
                  {/* Name */}
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-zinc-700">
                      Nama Lengkap
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="name"
                        placeholder="Nama kamu"
                        {...register("name")}
                        className={cn(
                          "h-11 bg-white/80 pl-10 transition-all",
                          errors.name
                            ? "border-red-400 focus-visible:ring-red-400/30"
                            : "focus-visible:ring-primary/20"
                        )}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-xs text-red-500">{errors.name.message}</p>
                    )}
                  </motion.div>

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

                  {/* Password + Confirm side by side */}
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          id="password"
                          type={showPass ? "text" : "password"}
                          placeholder="Buat password"
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

                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
                        Konfirmasi
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Ulangi password"
                          {...register("confirmPassword")}
                          className={cn(
                            "h-11 bg-white/80 pl-10 pr-11 transition-all",
                            errors.confirmPassword
                              ? "border-red-400 focus-visible:ring-red-400/30"
                              : passwordsMatch
                                ? "border-emerald-400 focus-visible:ring-emerald-400/30"
                                : "focus-visible:ring-primary/20"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
                          tabIndex={-1}
                        >
                          {showConfirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-red-500">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </motion.div>
                  </div>

                  <PasswordStrength password={passwordValue} />

                  {confirmValue.length > 0 && (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        passwordsMatch ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {passwordsMatch ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Password cocok
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5" /> Password belum cocok
                        </>
                      )}
                    </p>
                  )}

                  {/* reCAPTCHA */}
                  <motion.div variants={itemVariants} className="pt-1">
                    <RecaptchaWidget
                      onVerify={() => setCaptchaDone(true)}
                      onExpire={() => setCaptchaDone(false)}
                    />
                  </motion.div>

                  {/* Terms */}
                  <motion.p
                    variants={itemVariants}
                    className="text-center text-[11px] leading-relaxed text-zinc-500"
                  >
                    Dengan mendaftar, kamu menyetujui{" "}
                    <Link
                      href="/terms"
                      className="font-medium text-zinc-700 underline-offset-2 hover:underline"
                    >
                      Syarat & Ketentuan
                    </Link>{" "}
                    dan{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-zinc-700 underline-offset-2 hover:underline"
                    >
                      Kebijakan Privasi
                    </Link>{" "}
                    Zenit.
                  </motion.p>

                  {/* Submit */}
                  <motion.div variants={itemVariants}>
                    <Button
                      type="submit"
                      size="lg"
                      className="group h-12 w-full text-[15px] font-semibold shadow-sm transition-all hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
                      disabled={isRegisterLoading || !captchaDone}
                      aria-disabled={isRegisterLoading || !captchaDone}
                    >
                      {isRegisterLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          Daftar Sekarang
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.form>

                {/* Footer trust */}
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dilindungi reCAPTCHA · Privasi terjamin
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}