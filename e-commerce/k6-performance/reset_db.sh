#!/usr/bin/env bash
# =============================================================
# reset_db.sh — Reset database + Redis antara setiap run k6
#
# Usage:
#   ./reset_db.sh                     # pakai DATABASE_URL dari env
#   ./reset_db.sh "postgresql://..."  # override URL langsung
#
# Bekerja di: Windows (Git Bash), Linux/VPS
# Letakkan file ini di: k6-performance/
#
# FIX v3:
#   - pending_payment: DISTINCT ON dihapus → plain JOIN addresses
#     supaya bisa seed hingga 30.000 rows (jumlah user×address di DB).
#     DISTINCT ON sebelumnya membatasi max = jumlah unique user saja.
#   - pending_payment LIMIT: 500 → 2000
#     Load test butuh ~2.000 updates, stress test ~3.200.
#     Kapasitas DB: 30.000 (verified) — 2000 aman.
#   - confirmed/processing/shipped tetap DISTINCT ON + LIMIT 500
#     (hanya untuk filter variety di browse, tidak perlu banyak)
# =============================================================

# ── Resolve DB URL ─────────────────────────────────────────────
if [ -n "$1" ]; then
  DB="$1"
elif [ -n "$DATABASE_URL" ]; then
  DB="$DATABASE_URL"
else
  DB="postgresql://zenit:220711833@localhost:5432/ecommerce_db"
fi

echo ""
echo "🔄  Resetting database + Redis..."
echo "    DB: ${DB%%@*}@[hidden]"

psql "$DB" -q << 'SQL'

-- =============================================================
-- 1. HAPUS DATA TRANSAKSI (urutan penting — FK constraint)
-- =============================================================

DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;

-- =============================================================
-- 2. HAPUS SEMUA REFRESH TOKENS
-- =============================================================

DELETE FROM refresh_tokens;

-- =============================================================
-- 3. HAPUS ORPHAN K6 TEST PRODUCTS
-- =============================================================

DELETE FROM products WHERE name LIKE 'k6 Test Product %';

-- =============================================================
-- 4. RESET STATE
-- =============================================================

UPDATE carts SET status = 'active';
UPDATE products SET stock = 9999 WHERE stock < 9999;

-- =============================================================
-- 5. HAPUS K6 TEST USERS
-- =============================================================

DELETE FROM carts
  WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@k6test.dev');
DELETE FROM users WHERE email LIKE '%@k6test.dev';

-- =============================================================
-- 6. SEED ORDERS UNTUK S-05 ADMIN FLOW
-- =============================================================

-- pending_payment — FIX v3: plain JOIN (bukan DISTINCT ON), LIMIT 2000
-- Plain JOIN izinkan multi-order per user → bisa capai LIMIT 2000.
-- Sebelumnya DISTINCT ON membatasi ke 1 order per user.
INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                    shipping_address, payment_method, shipping_method,
                    order_number, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  a.id,
  'pending_payment',
  130000,
  13000,
  15000,
  158000,
  '{"city":"Jakarta"}'::jsonb,
  'bank_transfer',
  'regular',
  'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || a.id::text || random()::text), 1, 12),
  NOW() - (random() * interval '2 days'),
  NOW()
FROM users u
JOIN addresses a ON a.user_id = u.id
WHERE u.role = 'USER'
  AND u.email NOT LIKE '%@k6test.dev'
ORDER BY random()
LIMIT 2000;

-- confirmed — DISTINCT ON, LIMIT 500 (browse variety only)
INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                    shipping_address, payment_method, shipping_method,
                    order_number, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  a.id,
  'confirmed',
  150000,
  15000,
  15000,
  180000,
  '{"city":"Jakarta"}'::jsonb,
  'bank_transfer',
  'regular',
  'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
  NOW() - (random() * interval '5 days'),
  NOW()
FROM users u
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM addresses
  ORDER BY user_id, created_at ASC
) a ON a.user_id = u.id
WHERE u.role = 'USER'
  AND u.email NOT LIKE '%@k6test.dev'
ORDER BY random()
LIMIT 500;

-- processing — DISTINCT ON, LIMIT 500
INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                    shipping_address, payment_method, shipping_method,
                    order_number, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  a.id,
  'processing',
  175000,
  17500,
  15000,
  207500,
  '{"city":"Jakarta"}'::jsonb,
  'qris',
  'express',
  'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
  NOW() - (random() * interval '7 days'),
  NOW()
FROM users u
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM addresses
  ORDER BY user_id, created_at ASC
) a ON a.user_id = u.id
WHERE u.role = 'USER'
  AND u.email NOT LIKE '%@k6test.dev'
ORDER BY random()
LIMIT 500;

-- shipped — DISTINCT ON, LIMIT 500
INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                    shipping_address, payment_method, shipping_method,
                    order_number, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  a.id,
  'shipped',
  200000,
  20000,
  15000,
  235000,
  '{"city":"Jakarta"}'::jsonb,
  'cod',
  'regular',
  'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
  NOW() - (random() * interval '10 days'),
  NOW()
FROM users u
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM addresses
  ORDER BY user_id, created_at ASC
) a ON a.user_id = u.id
WHERE u.role = 'USER'
  AND u.email NOT LIKE '%@k6test.dev'
ORDER BY random()
LIMIT 500;

SQL

if [ $? -ne 0 ]; then
  echo "❌  Reset GAGAL. Cek koneksi DB atau string koneksi."
  exit 1
fi

# =============================================================
# 7. REDIS FLUSH
# =============================================================

redis-cli FLUSHDB 2>/dev/null && echo "🗑️  Redis cache cleared." || echo "⚠️  Redis tidak jalan, skip flush."

echo ""
echo "============================================"
echo "  reset_db.sh v3 — selesai"
echo "============================================"
echo ""
echo "  [OK] order_items, orders, cart_items  -> dihapus"
echo "  [OK] refresh_tokens                   -> semua dihapus"
echo "  [OK] k6 test products (orphan S-05)   -> dihapus"
echo "  [OK] carts                            -> status reset ke active"
echo "  [OK] products                         -> stock reset ke 9999"
echo "  [OK] k6test.dev users + carts         -> dihapus"
echo "  [OK] orders di-seed                   -> 2000 pending + 500x3 status lain"
echo "  [OK] Redis                            -> FLUSHDB"
echo ""
echo "  DB + Redis siap untuk run berikutnya."
echo "============================================"
echo ""