/**
 * auth.service.test.ts — Whitebox Unit Test (backend-rest)
 * Letakkan di: backend-rest/src/__tests__/unit/auth.service.test.ts
 *
 * FIX v2 (vs REST versi lama):
 *  [1] register() — bcrypt cost 12 → 10
 *  [2] changePassword() — bcrypt cost 12 → 10 (REST-only fix, tRPC tidak cek cost di sini)
 *  [3] refreshToken mock — tambah refreshToken.update: vi.fn()
 *  [4] refreshToken() happy path — SHA-256 tokenHash, return { accessToken, refreshToken }
 *  [5] refreshToken() expired — tokenHash SHA-256 nyata agar expiry check bisa diuji
 */

import { createHash }                                        from "node:crypto";
import { describe, it, expect, vi, beforeEach }              from "vitest";

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
      update:     vi.fn(),  // FIX [3]: service pakai update untuk revoke saat rotation
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET:         "test-jwt-secret-minimum-32-chars-long!!",
    JWT_REFRESH_SECRET: "test-jwt-refresh-secret-minimum-32!!!",
    JWT_EXPIRY:         "1h",
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
import { prisma }    from "../../config/database";
import bcrypt        from "bcrypt";
import jwt           from "jsonwebtoken";
import * as authService from "../../services/auth.service";

// ─── Typed mocks ─────────────────────────────────────────────────────────────
const mockPrismaUser         = prisma.user         as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockPrismaRefreshToken = prisma.refreshToken as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockBcrypt             = bcrypt              as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockJwt                = jwt                as unknown as Record<string, ReturnType<typeof vi.fn>>;

const mockUser = {
  id:           "user-uuid-123",
  name:         "Budi Santoso",
  email:        "budi@test.com",
  role:         "USER" as const,
  passwordHash: "$2b$10$hashedpassword",
  phone:        "081234567890",
  createdAt:    new Date("2024-01-01"),
};

beforeEach(() => { vi.clearAllMocks(); });

// ─── Helper SHA-256 ───────────────────────────────────────────────────────────
// Meniru hashToken() di service. Dipakai untuk membuat tokenHash fixture yang valid.
function hashForTest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// =============================================================================
// 1. register()
// =============================================================================
describe("authService.register()", () => {
  const registerInput = {
    name: "Budi Santoso", email: "budi@test.com", password: "TestPass123!",
  };

  it("✅ berhasil register — return user, accessToken, refreshToken", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("$2b$10$hashed");
    mockPrismaUser.create.mockResolvedValue(mockUser);
    mockJwt.sign
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");
    mockPrismaRefreshToken.create.mockResolvedValue({});

    const result = await authService.register(registerInput);

    expect(result).toHaveProperty("user");
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
    expect(result.user.email).toBe("budi@test.com");
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
  });

  it("✅ throw 409 jika email sudah terdaftar", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);

    await expect(authService.register(registerInput))
      .rejects.toMatchObject({ status: 409, message: "Email sudah terdaftar." });

    expect(mockPrismaUser.create).not.toHaveBeenCalled();
  });

  it("✅ password di-hash dengan bcrypt cost 10", async () => {
    // FIX [1]: cost 10, bukan 12
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("$2b$10$securely_hashed");
    mockPrismaUser.create.mockResolvedValue(mockUser);
    mockJwt.sign.mockReturnValue("token");
    mockPrismaRefreshToken.create.mockResolvedValue({});

    await authService.register(registerInput);

    // FIX [1]: cost 10, bukan 12
    expect(mockBcrypt.hash).toHaveBeenCalledWith("TestPass123!", 10);
  });

  it("✅ password yang disimpan ke DB adalah hash, bukan plaintext", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue("$2b$10$securely_hashed");
    mockPrismaUser.create.mockResolvedValue(mockUser);
    mockJwt.sign.mockReturnValue("token");
    mockPrismaRefreshToken.create.mockResolvedValue({});

    await authService.register(registerInput);

    const createCall = mockPrismaUser.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).toBe("$2b$10$securely_hashed");
    expect(createCall.data).not.toHaveProperty("password");
    expect(createCall.data.passwordHash).not.toBe("TestPass123!");
  });
});

// =============================================================================
// 2. login()
// =============================================================================
describe("authService.login()", () => {
  const loginInput = { email: "budi@test.com", password: "TestPass123!" };

  it("✅ berhasil login — return user, accessToken, refreshToken", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");
    mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaRefreshToken.create.mockResolvedValue({});

    const result = await authService.login(loginInput);

    expect(result.user.email).toBe("budi@test.com");
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
  });

  it("✅ throw 401 jika email tidak ditemukan", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    await expect(authService.login(loginInput)).rejects.toMatchObject({ status: 401 });
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it("✅ throw 401 jika password salah", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(authService.login(loginInput)).rejects.toMatchObject({ status: 401 });
  });

  it("✅ pesan error email-salah dan password-salah identik (anti user-enumeration)", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    let errNoEmail: any;
    try { await authService.login(loginInput); } catch (e) { errNoEmail = e; }

    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);
    let errBadPass: any;
    try { await authService.login(loginInput); } catch (e) { errBadPass = e; }

    expect(errNoEmail?.message).toBe(errBadPass?.message);
    expect(errNoEmail?.status).toBe(errBadPass?.status);
  });

  it("✅ login merevoke token lama sebelum buat yang baru (cegah accumulation)", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign.mockReturnValue("token");
    mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    mockPrismaRefreshToken.create.mockResolvedValue({});

    await authService.login(loginInput);

    expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: mockUser.id, revoked: false },
      data:  { revoked: true },
    });
  });
});

// =============================================================================
// 3. logout()
// =============================================================================
describe("authService.logout()", () => {
  it("✅ revoke semua refresh token milik user (updateMany)", async () => {
    mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    await authService.logout("user-uuid-123");
    expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-uuid-123", revoked: false },
      data:  { revoked: true },
    });
  });

  it("✅ tidak throw jika user tidak punya token aktif", async () => {
    mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(authService.logout("user-uuid-123")).resolves.not.toThrow();
  });
});

// =============================================================================
// 4. refreshToken()
// =============================================================================
describe("authService.refreshToken()", () => {
  // FIX [4]: Service memakai SHA-256 (bukan bcrypt) untuk compare tokenHash.
  // Token fixture harus memakai hashForTest() agar service menemukan validToken.
  const RAW_TOKEN  = "raw-refresh-token-string";
  const VALID_HASH = hashForTest(RAW_TOKEN);

  it("✅ mengembalikan { accessToken, refreshToken } baru jika token valid", async () => {
    // FIX [4]: tokenHash harus SHA-256 nyata dari RAW_TOKEN
    const storedToken = {
      id:        "rt-row-1",
      userId:    "user-uuid-123",
      tokenHash: VALID_HASH,                           // ← SHA-256 nyata
      expiresAt: new Date(Date.now() + 86_400_000),    // belum expired
      revoked:   false,
    };

    mockJwt.verify.mockReturnValue({ userId: "user-uuid-123", role: "USER" });
    mockPrismaRefreshToken.findMany.mockResolvedValue([storedToken]);
    mockPrismaRefreshToken.update.mockResolvedValue({});   // FIX [3]: revoke lama
    mockPrismaRefreshToken.create.mockResolvedValue({});   // buat baru
    mockJwt.sign.mockReturnValue("new-access-token");

    const result = await authService.refreshToken(RAW_TOKEN);

    // FIX [4]: return berubah dari string → { accessToken, refreshToken }
    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBeDefined();

    // Token lama harus di-revoke
    expect(mockPrismaRefreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-row-1" },
        data:  { revoked: true },
      })
    );
    expect(mockPrismaRefreshToken.create).toHaveBeenCalledOnce();
  });

  it("✅ throw 401 jika jwt.verify gagal", async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error("jwt malformed"); });
    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it("✅ throw 401 jika tidak ada token cocok di DB", async () => {
    mockJwt.verify.mockReturnValue({ userId: "user-uuid-123", role: "USER" });
    mockPrismaRefreshToken.findMany.mockResolvedValue([]);
    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it("✅ throw 401 jika tokenHash tidak cocok (SHA-256 beda)", async () => {
    mockJwt.verify.mockReturnValue({ userId: "user-uuid-123", role: "USER" });
    mockPrismaRefreshToken.findMany.mockResolvedValue([
      {
        id: "rt-1", userId: "user-uuid-123",
        tokenHash: "bukan-sha256-dari-raw-token",   // ← sengaja salah
        expiresAt: new Date(Date.now() + 10_000),
        revoked:   false,
      },
    ]);
    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
    // Memastikan bcrypt TIDAK dipakai — ini SHA-256 comparison
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it("✅ throw 401 jika token sudah expired", async () => {
    // FIX [5]: tokenHash harus SHA-256 nyata agar validToken DITEMUKAN,
    // baru kemudian expiry check dapat dijalankan
    mockJwt.verify.mockReturnValue({ userId: "user-uuid-123", role: "USER" });
    mockPrismaRefreshToken.findMany.mockResolvedValue([
      {
        id:        "rt-1",
        userId:    "user-uuid-123",
        tokenHash: VALID_HASH,                      // ← SHA-256 nyata, token ditemukan
        expiresAt: new Date(Date.now() - 1_000),    // ← sudah expired
        revoked:   false,
      },
    ]);
    await expect(authService.refreshToken(RAW_TOKEN)).rejects.toMatchObject({ status: 401 });
  });
});

// =============================================================================
// 5. changePassword()
// =============================================================================
describe("authService.changePassword()", () => {
  const fakeUser = {
    id: "user-uuid-123", passwordHash: "$2b$10$oldhash",
  };

  it("✅ berhasil ganti password", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue("$2b$10$newhash");
    mockPrismaUser.update.mockResolvedValue({});
    mockPrismaRefreshToken.updateMany.mockResolvedValue({});

    const result = await authService.changePassword("user-uuid-123", "OldPass456!", "NewPass456!");
    expect(result.message).toBe("Password berhasil diubah");
  });

  it("✅ password baru di-hash dengan bcrypt cost 10", async () => {
    // FIX [2]: REST auth.service changePassword memakai cost 10 (FIX #1)
    mockPrismaUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue("$2b$10$newhash");
    mockPrismaUser.update.mockResolvedValue({});
    mockPrismaRefreshToken.updateMany.mockResolvedValue({});

    await authService.changePassword("user-uuid-123", "OldPass456!", "NewPass456!");

    // FIX [2]: cost 10, BUKAN 12
    expect(mockBcrypt.hash).toHaveBeenCalledWith("NewPass456!", 10);
  });

  it("✅ throw 404 jika user tidak ditemukan", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    await expect(
      authService.changePassword("ghost", "old", "new")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("✅ throw 400 jika password lama salah", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(fakeUser);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(
      authService.changePassword("user-uuid-123", "WrongOld!", "NewPass456!")
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrismaUser.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 6. getProfile()
// =============================================================================
describe("authService.getProfile()", () => {
  it("✅ return profil user dengan phone dan role", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(mockUser);

    const result = await authService.getProfile("user-uuid-123");

    expect(result.user).toMatchObject({ id: "user-uuid-123", role: "USER" });
    // Regression: phone harus ada di response (pernah hilang dari select)
    expect(result.user).toHaveProperty("phone");
    expect(result.user.phone).toBe("081234567890");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("✅ throw 404 jika user tidak ditemukan", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    await expect(authService.getProfile("ghost-id")).rejects.toMatchObject({ status: 404 });
  });
});