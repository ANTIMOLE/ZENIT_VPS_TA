/**
 * auth.service.test.ts — Whitebox Unit Test (backend-trpc)
 * Letakkan di: backend-trpc/src/__tests__/unit/auth.service.test.ts
 *
 * FIX v2:
 *  [1] register() — bcrypt cost 12 → 10 (FIX #1 service)
 *  [2] refreshToken() mock — tambah refreshToken.update: vi.fn() (service pakai update untuk revoke)
 *  [3] refreshToken() happy path:
 *        - SHA-256 (crypto.createHash) menggantikan bcrypt untuk tokenHash comparison
 *        - tokenHash fixture harus berisi SHA-256 hash nyata dari token string
 *        - return type berubah dari string → { accessToken, refreshToken }
 *  [4] refreshToken() expired — tokenHash juga harus SHA-256 nyata agar validToken ditemukan
 *        sebelum expiry check dijalankan
 */

import { createHash }          from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCK ────────────────────────────────────────────────────────────────────
vi.mock("../../config/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    refreshToken: {
      create:     vi.fn(),
      findMany:   vi.fn(),
      updateMany: vi.fn(),
      update:     vi.fn(),   // FIX [2]: service pakai update untuk revoke token lama (rotation)
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET:         "test-jwt-secret-minimum-32-chars-long!!",
    JWT_REFRESH_SECRET: "test-refresh-secret-minimum-32-chars!!",
    JWT_EXPIRY:         "15m",
    JWT_REFRESH_EXPIRY: "7d",
    NODE_ENV:           "test",
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash:    vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign:   vi.fn(),
    verify: vi.fn(),
  },
}));

// ─── Import setelah mock ──────────────────────────────────────────────────────
import { prisma }  from "../../config/database";
import bcrypt      from "bcrypt";
import jwt         from "jsonwebtoken";
import {
  register,
  login,
  logout,
  changePassword,
  getProfile,
  refreshToken,
} from "../../services/auth.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockUser  = prisma.user         as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockToken = prisma.refreshToken as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockBcrypt = bcrypt             as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockJwt   = jwt                 as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => { vi.clearAllMocks(); });

// ─── Helper SHA-256 ───────────────────────────────────────────────────────────
// Service memakai createHash("sha256") untuk hash refresh token.
// Test harus menyediakan tokenHash yang cocok agar service bisa menemukan validToken.
function hashForTest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// =============================================================================
// register()
// =============================================================================
describe("register()", () => {
  const input = { name: "Budi", email: "budi@test.com", password: "Rahasia123!" };

  it("✅ berhasil register dan return user + tokens", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("hashed-password");
    mockUser.create.mockResolvedValue({
      id: "user-1", name: "Budi", email: "budi@test.com",
      role: "USER", createdAt: new Date(),
    });
    mockJwt.sign
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");
    mockToken.create.mockResolvedValue({});

    const result = await register(input);

    expect(result.user.email).toBe("budi@test.com");
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(mockUser.create).toHaveBeenCalledOnce();
    expect(mockToken.create).toHaveBeenCalledOnce();
  });

  it("✅ throw 409 jika email sudah terdaftar", async () => {
    mockUser.findUnique.mockResolvedValue({ id: "existing", email: input.email });

    await expect(register(input)).rejects.toMatchObject({
      status: 409,
      message: "Email sudah terdaftar.",
    });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("✅ password di-hash dengan bcrypt cost 10 (bukan 12)", async () => {
    // FIX [1]: service sekarang pakai cost 10 (bukan 12) — lebih cepat, masih aman
    mockUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("hashed-password");
    mockUser.create.mockResolvedValue({
      id: "user-1", name: "Budi", email: input.email,
      role: "USER", createdAt: new Date(),
    });
    mockJwt.sign.mockReturnValue("token");
    mockToken.create.mockResolvedValue({});

    await register(input);

    // FIX [1]: cost 10, BUKAN 12
    expect(mockBcrypt.hash).toHaveBeenCalledWith(input.password, 10);
    const createCall = mockUser.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).toBe("hashed-password");
    expect(createCall.data).not.toHaveProperty("password");
  });
});

// =============================================================================
// login()
// =============================================================================
describe("login()", () => {
  const input    = { email: "budi@test.com", password: "Rahasia123!" };
  const fakeUser = {
    id: "user-1", name: "Budi", email: "budi@test.com",
    role: "USER", passwordHash: "hashed-password",
  };

  it("✅ berhasil login dan return user + tokens", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");
    mockToken.updateMany.mockResolvedValue({ count: 0 });
    mockToken.create.mockResolvedValue({});

    const result = await login(input);

    expect(result.user.email).toBe("budi@test.com");
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
  });

  it("✅ throw 401 jika email tidak ditemukan", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    await expect(login(input)).rejects.toMatchObject({ status: 401 });
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it("✅ throw 401 jika password salah", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(login(input)).rejects.toMatchObject({
      status: 401, message: "Email atau password salah.",
    });
    expect(mockToken.create).not.toHaveBeenCalled();
  });

  it("✅ pesan error email-salah dan password-salah identik (anti-enumeration)", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    let errNoEmail: any;
    try { await login(input); } catch (e) { errNoEmail = e; }

    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(false);
    let errBadPass: any;
    try { await login(input); } catch (e) { errBadPass = e; }

    expect(errNoEmail?.message).toBe(errBadPass?.message);
    expect(errNoEmail?.status).toBe(errBadPass?.status);
  });

  it("✅ password divalidasi via bcrypt.compare (tidak compare plaintext)", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign.mockReturnValue("token");
    mockToken.updateMany.mockResolvedValue({});
    mockToken.create.mockResolvedValue({});
    await login(input);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(input.password, fakeUser.passwordHash);
  });

  it("✅ login merevoke token lama sebelum buat yang baru (anti token accumulation)", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign.mockReturnValue("token");
    mockToken.updateMany.mockResolvedValue({ count: 2 });
    mockToken.create.mockResolvedValue({});
    await login(input);
    expect(mockToken.updateMany).toHaveBeenCalledWith({
      where: { userId: fakeUser.id, revoked: false },
      data:  { revoked: true },
    });
  });
});

// =============================================================================
// logout()
// =============================================================================
describe("logout()", () => {
  it("✅ revoke semua refresh token milik user", async () => {
    mockToken.updateMany.mockResolvedValue({ count: 2 });
    await logout("user-1");
    expect(mockToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revoked: false },
      data:  { revoked: true },
    });
  });
});

// =============================================================================
// changePassword()
// =============================================================================
describe("changePassword()", () => {
  const fakeUser = { id: "user-1", passwordHash: "old-hash" };

  it("✅ berhasil ganti password dan revoke semua token", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue("new-hash");
    mockUser.update.mockResolvedValue({});
    mockToken.updateMany.mockResolvedValue({});

    const result = await changePassword("user-1", "OldPass!", "NewPass123!");

    expect(result.message).toBe("Password berhasil diubah");
    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "new-hash" } })
    );
    expect(mockToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", revoked: false } })
    );
  });

  it("✅ throw 404 jika user tidak ditemukan", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    await expect(changePassword("ghost", "old", "new")).rejects.toMatchObject({ status: 404 });
  });

  it("✅ throw 400 jika password lama salah", async () => {
    mockUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(changePassword("user-1", "WrongPass!", "new")).rejects.toMatchObject({
      status: 400, message: "Password lama salah",
    });
    expect(mockUser.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getProfile()
// =============================================================================
describe("getProfile()", () => {
  it("✅ return profil user dengan phone, tanpa passwordHash", async () => {
    const fakeUser = {
      id: "user-1", name: "Budi", email: "budi@test.com",
      role: "USER", phone: "081234567890", createdAt: new Date(),
    };
    mockUser.findUnique.mockResolvedValue(fakeUser);

    const result = await getProfile("user-1");

    expect(result.user).toMatchObject({ id: "user-1", name: "Budi" });
    expect(result.user).toHaveProperty("role");
    expect(result.user.role).toBe("USER");
    // Regression: phone harus ada di response (pernah hilang dari select)
    expect(result.user).toHaveProperty("phone");
    expect(result.user.phone).toBe("081234567890");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("✅ throw 404 jika user tidak ditemukan", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    await expect(getProfile("ghost")).rejects.toMatchObject({ status: 404 });
  });
});

// =============================================================================
// refreshToken()
// =============================================================================
describe("refreshToken()", () => {
  // FIX [3]: Service sekarang pakai SHA-256 bukan bcrypt untuk hash comparison.
  // Token yang di-hash harus menghasilkan SHA-256 hex yang sama dengan yang tersimpan di DB.
  // hashForTest() meniru implementasi hashToken() di service.
  const RAW_TOKEN = "valid-refresh-token";
  const VALID_HASH = hashForTest(RAW_TOKEN);   // hash SHA-256 nyata dari token

  it("✅ return { accessToken, refreshToken } baru untuk refresh token valid", async () => {
    // FIX [3]: tokenHash harus SHA-256 nyata, bukan "$2b$10$hash" atau "hashed-rt"
    const fakeStoredToken = {
      id:        "rt-1",
      userId:    "user-1",
      tokenHash: VALID_HASH,                              // ← SHA-256 hash nyata
      expiresAt: new Date(Date.now() + 86_400_000),       // belum expired
      revoked:   false,
    };

    mockJwt.verify.mockReturnValue({ userId: "user-1", role: "USER" });
    mockToken.findMany.mockResolvedValue([fakeStoredToken]);
    mockToken.update.mockResolvedValue({});               // FIX [2]: revoke lama
    mockToken.create.mockResolvedValue({});               // buat baru
    mockJwt.sign.mockReturnValue("new-access-token");

    const result = await refreshToken(RAW_TOKEN);

    // FIX [3]: return type adalah { accessToken, refreshToken }, bukan string
    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBeDefined();

    // Verifikasi token lama di-revoke (rotation)
    expect(mockToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1" },
        data:  { revoked: true },
      })
    );
    // Verifikasi token baru dibuat
    expect(mockToken.create).toHaveBeenCalledOnce();
    // JWT di-verify dengan secret yang benar
    expect(mockJwt.verify).toHaveBeenCalledWith(
      RAW_TOKEN,
      "test-refresh-secret-minimum-32-chars!!"
    );
  });

  it("✅ throw 401 jika jwt.verify gagal", async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error("invalid signature"); });
    await expect(refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it("✅ throw 401 jika tidak ada token cocok di DB (findMany kosong)", async () => {
    mockJwt.verify.mockReturnValue({ userId: "user-1", role: "USER" });
    mockToken.findMany.mockResolvedValue([]);
    await expect(refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it("✅ throw 401 jika tokenHash tidak cocok (SHA-256 berbeda)", async () => {
    // Token di DB punya hash yang BERBEDA dari SHA-256 token yang dikirim
    mockJwt.verify.mockReturnValue({ userId: "user-1", role: "USER" });
    mockToken.findMany.mockResolvedValue([
      {
        id: "rt-1", userId: "user-1",
        tokenHash: "wrong-hash-that-is-not-sha256-of-rawtoken",
        expiresAt: new Date(Date.now() + 10_000),
        revoked:   false,
      },
    ]);
    await expect(refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
    // bcrypt.compare tidak pernah dipanggil — SHA-256 comparison, bukan bcrypt
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it("✅ throw 401 jika token sudah expired (expiresAt lampau)", async () => {
    // FIX [4]: tokenHash harus SHA-256 nyata supaya validToken DITEMUKAN
    // baru kemudian expiry check dijalankan
    mockJwt.verify.mockReturnValue({ userId: "user-1", role: "USER" });
    mockToken.findMany.mockResolvedValue([
      {
        id:        "rt-1",
        userId:    "user-1",
        tokenHash: VALID_HASH,                      // ← SHA-256 nyata, token ditemukan
        expiresAt: new Date(Date.now() - 1_000),    // ← sudah expired
        revoked:   false,
      },
    ]);
    await expect(refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });
});