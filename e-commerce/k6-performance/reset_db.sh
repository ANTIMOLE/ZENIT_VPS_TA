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
# FIX dari versi sebelumnya:
#   1. DELETE refresh_tokens semua (bukan hanya expired)
#   2. DELETE orphan k6 test products
#   3. LIMIT 50 ? 500 pending orders — 50 habis dalam menit pertama
#      karena 30 VU × 51 menit = ~1937 admin_orders group executions
#   4. Seed orders dengan BERBAGAI status (bukan hanya pending_payment)
#      supaya semua filter di s05_admin.js bisa return result dan
#      admin_order_update_skip tidak 100%
#   5. Urutan DELETE dibenerin: refresh_tokens sebelum users (FK constraint)
#   6. Redis FLUSHDB
# =============================================================

# -- Resolve DB URL ---------------------------------------------
if [ -n "$1" ]; then
  DB="$1"
elif [ -n "$DATABASE_URL" ]; then
  DB="$DATABASE_URL"
else
  DB="postgresql://zenit:220711833@localhost:5432/ecommerce_db"
fi

echo ""
echo "??  Resetting database + Redis..."
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
--
-- FIX v2:
--   - LIMIT 50 ? 500 per status. Sebelumnya 50 total habis dalam
--     menit pertama (30 VU × 51 menit = ~1937 executions).
--   - Seed 4 status berbeda (pending_payment, confirmed, processing,
--     shipped) supaya semua filter random di s05_admin.js bisa
--     return result — bukan hanya pending_payment saja.
--   - Total: 500 × 4 status = 2000 orders ? cukup untuk full run.
-- =============================================================

-- pending_payment (target utama updateOrderStatus)
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
  'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
  NOW() - (random() * interval '2 days'),
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

-- confirmed
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

-- processing
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

-- shipped
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
  echo "?  Reset GAGAL. Cek koneksi DB atau string koneksi."
  exit 1
fi

# =============================================================
# 7. REDIS FLUSH
# =============================================================

redis-cli FLUSHDB 2>/dev/null && echo "???  Redis cache cleared." || echo "??  Redis tidak jalan, skip flush."

echo "?  Reset selesai."
echo ""
echo "   Yang sudah direset:"
echo "   ? order_items, orders, cart_items ? dihapus"
echo "   ? refresh_tokens ? semua dihapus"
echo "   ? k6 test products (orphan S-05) ? dihapus"
echo "   ? carts ? status reset ke 'active'"
echo "   ? products ? stock reset ke 9999"
echo "   ? k6test.dev users + carts ? dihapus"
echo "   ? 2000 orders di-seed (500 × 4 status) untuk S-05"
echo "   ? Redis ? FLUSHDB"
echo ""
echo "   DB + Redis siap untuk run berikutnya."
echo ""