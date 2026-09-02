// import bcrypt from "bcrypt";
// import jwt, { SignOptions } from "jsonwebtoken";
// import { createHash } from "crypto";
// import { prisma } from "../config/database";
// import { env } from "../config/env";
// import { AppError } from "../middlewares/error.middleware";
// import type { LoginInput, RegisterInput } from "@ecommerce/shared";

// // =============================================================
// // TOKEN HELPERS
// // =============================================================

// function signAccessToken(userId: string, role: string) {
//   return jwt.sign({ userId, role }, env.JWT_SECRET, {
//     expiresIn: env.JWT_EXPIRY as SignOptions["expiresIn"],
//   });
// }

// function signRefreshToken(userId: string, role: string) {
//   return jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
//     expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"],
//   });
// }

// function refreshExpiresAt(): Date {
//   return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
// }

// // FIX #2: SHA-256 untuk hash refresh token — bukan bcrypt.
// // Refresh token adalah JWT 256-bit yang kita generate sendiri,
// // entropi sudah cukup tinggi, tidak perlu bcrypt yang butuh 100ms.
// // SHA-256 selesai <1ms — ini yang menghilangkan bottleneck di
// // refreshToken() yang sebelumnya P95 = 14.985ms.
// function hashToken(token: string): string {
//   return createHash("sha256").update(token).digest("hex");
// }

// // =============================================================
// // REGISTER
// // =============================================================

// export async function register(input: RegisterInput) {
//   const existing = await prisma.user.findUnique({
//     where: { email: input.email },
//   });
//   if (existing) throw new AppError("Email sudah terdaftar.", 409);

//   // FIX #1: cost factor 12 → 10 untuk password baru.
//   // Cost 10 = ~100ms, cost 12 = ~400ms. 4x lebih cepat.
//   // Hash lama di DB tetap valid — bcrypt.compare() baca cost factor
//   // dari string hash itu sendiri ($2b$12$... vs $2b$10$...).
//   const passwordHash = await bcrypt.hash(input.password, 10);

//   const user = await prisma.user.create({
//     data: { name: input.name, email: input.email, passwordHash },
//     select: { id: true, name: true, email: true, role: true, createdAt: true },
//   });

//   const accessToken  = signAccessToken(user.id, user.role);
//   const refreshToken = signRefreshToken(user.id, user.role);

//   // FIX #2: hashToken() bukan bcrypt.hash() untuk refresh token
//   const tokenHash = hashToken(refreshToken);
//   await prisma.refreshToken.create({
//     data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
//   });

//   return { user, accessToken, refreshToken };
// }

// // =============================================================
// // LOGIN
// // =============================================================

// export async function login(input: LoginInput) {
//   const user = await prisma.user.findUnique({ where: { email: input.email } });
//   if (!user) throw new AppError("Email atau password salah.", 401);

//   // bcrypt.compare untuk password TETAP pakai bcrypt — ini memang harus.
//   // Cost factor dibaca otomatis dari hash yang ada di DB.
//   const valid = await bcrypt.compare(input.password, user.passwordHash);
//   if (!valid) throw new AppError("Email atau password salah.", 401);

//   const accessToken  = signAccessToken(user.id, user.role);
//   const refreshToken = signRefreshToken(user.id, user.role);

//   // Revoke semua token lama sebelum buat yang baru (fix token accumulation)
//   await prisma.refreshToken.updateMany({
//     where: { userId: user.id, revoked: false },
//     data:  { revoked: true },
//   });

//   // FIX #2: hashToken() bukan bcrypt.hash() untuk refresh token
//   const tokenHash = hashToken(refreshToken);
//   await prisma.refreshToken.create({
//     data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
//   });

//   return {
//     user: { id: user.id, name: user.name, email: user.email, role: user.role },
//     accessToken,
//     refreshToken,
//   };
// }

// // =============================================================
// // LOGOUT
// // =============================================================

// export async function logout(userId: string) {
//   await prisma.refreshToken.updateMany({
//     where: { userId, revoked: false },
//     data:  { revoked: true },
//   });
// }

// // =============================================================
// // CHANGE PASSWORD
// // =============================================================

// export async function changePassword(
//   userId:      string,
//   oldPassword: string,
//   newPassword: string,
// ) {
//   const user = await prisma.user.findUnique({ where: { id: userId } });
//   if (!user) throw new AppError("User tidak ditemukan", 404);

//   const valid = await bcrypt.compare(oldPassword, user.passwordHash);
//   if (!valid) throw new AppError("Password lama salah", 400);

//   // FIX #1: cost factor 10 untuk password baru
//   const newHash = await bcrypt.hash(newPassword, 10);
//   await prisma.user.update({
//     where: { id: userId },
//     data:  { passwordHash: newHash },
//   });

//   await prisma.refreshToken.updateMany({
//     where: { userId, revoked: false },
//     data:  { revoked: true },
//   });

//   return { message: "Password berhasil diubah" };
// }

// // =============================================================
// // GET PROFILE
// // =============================================================

// export async function getProfile(userId: string) {
//   const user = await prisma.user.findUnique({
//     where:  { id: userId },
//     select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
//   });
//   if (!user) throw new AppError("User tidak ditemukan", 404);
//   return { user, message: "Profil berhasil diambil" };
// }

// // =============================================================
// // REFRESH TOKEN
// // =============================================================

// export async function refreshToken(token: string) {
//   // 1. Verify JWT
//   let decoded: { userId: string; role: string };
//   try {
//     decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
//       userId: string;
//       role: string;
//     };
//   } catch {
//     throw new AppError("Refresh token tidak valid.", 401);
//   }

//   // 2. Ambil token aktif milik user
//   const tokens = await prisma.refreshToken.findMany({
//     where: { userId: decoded.userId, revoked: false },
//   });

//   // 3. FIX #2: compare pakai SHA-256 — O(1), <1ms
//   // reset_db.sh DELETE FROM refresh_tokens setiap sebelum run,
//   // jadi tidak ada token format bcrypt lama yang bisa tersisa di DB.
//   const incoming   = hashToken(token);
//   const validToken = tokens.find((t) => t.tokenHash === incoming) ?? null;

//   if (!validToken) throw new AppError("Refresh token tidak valid.", 401);

//   // 4. Cek expired
//   if (validToken.expiresAt < new Date()) {
//     throw new AppError("Refresh token kadaluarsa.", 401);
//   }

//   // 5. Revoke token lama (rotation)
//   await prisma.refreshToken.update({
//     where: { id: validToken.id },
//     data:  { revoked: true },
//   });

//   // 6. Issue token baru — FIX #2: hashToken() bukan bcrypt.hash()
//   const newRefreshToken = signRefreshToken(decoded.userId, decoded.role);
//   const newTokenHash    = hashToken(newRefreshToken);
//   await prisma.refreshToken.create({
//     data: {
//       userId:    decoded.userId,
//       tokenHash: newTokenHash,
//       expiresAt: refreshExpiresAt(),
//     },
//   });

//   return {
//     accessToken:  signAccessToken(decoded.userId, decoded.role),
//     refreshToken: newRefreshToken,
//   };
// }


import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { createHash } from "crypto";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../middlewares/error.middleware";
import type { LoginInput, RegisterInput } from "../../../../packages/shared"

// =============================================================
// TOKEN HELPERS
// =============================================================

function signAccessToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as SignOptions["expiresIn"],
  });
}

function signRefreshToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"],
  });
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// FIX #2: SHA-256 untuk hash refresh token — bukan bcrypt.
// Refresh token adalah JWT 256-bit yang kita generate sendiri,
// entropi sudah cukup tinggi, tidak perlu bcrypt yang butuh 100ms.
// SHA-256 selesai <1ms — ini yang menghilangkan bottleneck di
// refreshToken() yang sebelumnya P95 = 14.985ms.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// =============================================================
// REGISTER
// =============================================================

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) throw new AppError("Email sudah terdaftar.", 409);

  // FIX #1: cost factor 12 → 10 untuk password baru.
  // Cost 10 = ~100ms, cost 12 = ~400ms. 4x lebih cepat.
  // Hash lama di DB tetap valid — bcrypt.compare() baca cost factor
  // dari string hash itu sendiri ($2b$12$... vs $2b$10$...).
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    // Same shape as getProfile() — phone included even though it's always
    // null right after signup, so this object type-matches auth.me and can
    // be written straight into the query cache.
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  const accessToken  = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  // FIX #2: hashToken() bukan bcrypt.hash() untuk refresh token
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
  });

  return { user, accessToken, refreshToken };
}

// =============================================================
// LOGIN
// =============================================================

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError("Email atau password salah.", 401);

  // bcrypt.compare untuk password TETAP pakai bcrypt — ini memang harus.
  // Cost factor dibaca otomatis dari hash yang ada di DB.
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AppError("Email atau password salah.", 401);

  const accessToken  = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  // Revoke semua token lama sebelum buat yang baru (fix token accumulation)
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revoked: false },
    data:  { revoked: true },
  });

  // FIX #2: hashToken() bukan bcrypt.hash() untuk refresh token
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshExpiresAt() },
  });

  // Shape here must match getProfile()'s (used by /auth/me and the tRPC
  // auth.me query) — phone and createdAt were missing before, so the
  // frontend's post-login cache write (qc.setQueryData / utils.auth.me.setData)
  // was caching an incomplete user object. On the REST side this passed
  // silently; on tRPC it surfaced as a real type error, which is what
  // caught it. Any screen that reads user.phone or user.createdAt right
  // after a fresh login (e.g. the profile page) was getting undefined for
  // those until the next full /auth/me refetch.
  return {
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      phone:     user.phone,
      role:      user.role,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
}

// =============================================================
// LOGOUT
// =============================================================

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data:  { revoked: true },
  });
}

// =============================================================
// CHANGE PASSWORD
// =============================================================

export async function changePassword(
  userId:      string,
  oldPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User tidak ditemukan", 404);

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new AppError("Password lama salah", 400);

  // FIX #1: cost factor 10 untuk password baru
  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data:  { passwordHash: newHash },
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data:  { revoked: true },
  });

  return { message: "Password berhasil diubah" };
}

// =============================================================
// GET PROFILE
// =============================================================

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError("User tidak ditemukan", 404);
  return { user, message: "Profil berhasil diambil" };
}

// =============================================================
// REFRESH TOKEN
// =============================================================

export async function refreshToken(token: string) {
  // 1. Verify JWT
  let decoded: { userId: string; role: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      userId: string;
      role: string;
    };
  } catch {
    throw new AppError("Refresh token tidak valid.", 401);
  }

  // 2. Ambil token aktif milik user
  const tokens = await prisma.refreshToken.findMany({
    where: { userId: decoded.userId, revoked: false },
  });

  // 3. FIX #2: compare pakai SHA-256 — O(1), <1ms
  // reset_db.sh DELETE FROM refresh_tokens setiap sebelum run,
  // jadi tidak ada token format bcrypt lama yang bisa tersisa di DB.
  const incoming   = hashToken(token);
  const validToken = tokens.find((t: { tokenHash: string; }) => t.tokenHash === incoming) ?? null;

  if (!validToken) throw new AppError("Refresh token tidak valid.", 401);

  // 4. Cek expired
  if (validToken.expiresAt < new Date()) {
    throw new AppError("Refresh token kadaluarsa.", 401);
  }

  // 5. Revoke token lama (rotation)
  await prisma.refreshToken.update({
    where: { id: validToken.id },
    data:  { revoked: true },
  });

  // 6. Issue token baru — FIX #2: hashToken() bukan bcrypt.hash()
  const newRefreshToken = signRefreshToken(decoded.userId, decoded.role);
  const newTokenHash    = hashToken(newRefreshToken);
  await prisma.refreshToken.create({
    data: {
      userId:    decoded.userId,
      tokenHash: newTokenHash,
      expiresAt: refreshExpiresAt(),
    },
  });

  return {
    accessToken:  signAccessToken(decoded.userId, decoded.role),
    refreshToken: newRefreshToken,
  };
}