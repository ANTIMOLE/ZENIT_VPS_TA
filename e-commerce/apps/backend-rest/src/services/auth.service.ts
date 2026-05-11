import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../middlewares/error.middleware";
import type { LoginInput, RegisterInput } from "@ecommerce/shared";

// --- Token helpers ------------------------------------------------------------

function signAccessToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as SignOptions["expiresIn"],
  });
}

// FIX #11: tambah `role` ke payload refresh token supaya refreshToken() tidak
// perlu findUnique user lagi hanya untuk ambil role — hemat 1 DB roundtrip.
// Sebelumnya: signRefreshToken(userId) ? decoded hanya punya userId ? harus
// findUnique user untuk dapat role ? 1 roundtrip ekstra per refresh.
function signRefreshToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"],
  });
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari
}

// --- register -----------------------------------------------------------------

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("Email sudah terdaftar.", 409);

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data:   { name: input.name, email: input.email, passwordHash },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const accessToken  = signAccessToken(user.id, user.role);
  // FIX #11: pass role ke signRefreshToken
  const refreshToken = signRefreshToken(user.id, user.role);

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
  });

  return { user, accessToken, refreshToken };
}

// --- login --------------------------------------------------------------------

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError("Email atau password salah.", 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AppError("Email atau password salah.", 401);

  const accessToken  = signAccessToken(user.id, user.role);
  // FIX #11: pass role ke signRefreshToken
  const refreshToken = signRefreshToken(user.id, user.role);

  // FIX #1: revoke semua token lama user ini sebelum buat yang baru.
  // Tanpa ini, setiap login nambah 1 baris di refresh_tokens tanpa batas
  // (token accumulation). Makin banyak token ? refreshToken() makin lambat
  // karena harus bcrypt.compare satu per satu (#16).
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revoked: false },
    data:  { revoked: true },
  });

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
}

// --- logout -------------------------------------------------------------------

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data:  { revoked: true },
  });
}

// --- changePassword -----------------------------------------------------------

export async function changePassword(
  userId:      string,
  oldPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User tidak ditemukan", 404);

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new AppError("Password lama salah", 400);

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

  // Paksa logout di semua device lain setelah ganti password
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data:  { revoked: true },
  });

  return { message: "Password berhasil diubah" };
}

// --- getProfile ---------------------------------------------------------------

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError("User tidak ditemukan", 404);
  return { user, message: "Profil berhasil diambil" };
}

// --- refreshToken -------------------------------------------------------------

export async function refreshToken(token: string) {
  // 1. Verify JWT — kalau expired atau invalid langsung reject
  let decoded: { userId: string; role: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string; role: string };
  } catch {
    throw new AppError("Refresh token tidak valid.", 401);
  }

  // 2. Cari token aktif milik user di DB.
  // FIX #16: dengan FIX #1 (revoke saat login) + FIX #2 (token rotation) di bawah,
  // user hanya punya max 1 active token ? loop bcrypt di bawah selalu O(1).
  // Sebelumnya tanpa revocation: bisa ratusan token ? loop O(n) bcrypt yang mahal.
  const tokens = await prisma.refreshToken.findMany({
    where: { userId: decoded.userId, revoked: false },
  });

  // 3. Cek hash match
  let validToken: (typeof tokens)[0] | null = null;
  for (const t of tokens) {
    const match = await bcrypt.compare(token, t.tokenHash);
    if (match) { validToken = t; break; }
  }
  if (!validToken) throw new AppError("Refresh token tidak valid.", 401);

  // 4. Cek expired
  if (validToken.expiresAt < new Date()) {
    throw new AppError("Refresh token kadaluarsa.", 401);
  }

  // FIX #2: Token rotation — revoke token lama, issue refresh token baru.
  // Tanpa ini refresh token bisa dipakai berkali-kali sampai expiresAt,
  // dan token accumulation (#1) terus tumbuh.
  // Dengan rotation: max 1 active token per user ? loop di atas O(1) ? fix #16 resolved.
  await prisma.refreshToken.update({
    where: { id: validToken.id },
    data:  { revoked: true },
  });

  // FIX #11: ambil role dari decoded JWT payload — tidak perlu findUnique user lagi.
  const newRefreshToken = signRefreshToken(decoded.userId, decoded.role);
  const newTokenHash    = await bcrypt.hash(newRefreshToken, 10);
  await prisma.refreshToken.create({
    data: { userId: decoded.userId, tokenHash: newTokenHash, expiresAt: refreshExpiresAt() },
  });

  return {
    accessToken:  signAccessToken(decoded.userId, decoded.role),
    refreshToken: newRefreshToken,
  };
}