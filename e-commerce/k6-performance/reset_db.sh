#!/usr/bin/env bash
# =============================================================
# reset_db.sh v5 — Reset database + Redis antara setiap run k6
#
# Usage:
#   ./reset_db.sh                     # pakai DATABASE_URL dari env
#   ./reset_db.sh "postgresql://..."  # override URL langsung
#
# FIX v4:
#   - Cek order count SEBELUM reset.
#     Kalau pending_payment >= 2000 DAN tidak ada sisa k6 data
#     (order_items + cart_items = 0), orders tidak di-delete + tidak di-reseed.
#
# v5:
#   - Tambah full DB state snapshot (row count per tabel) SEBELUM dan SESUDAH reset
#     supaya bisa verifikasi DB konsisten setiap run.
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
echo ""

# =============================================================
# FUNGSI: Print row count semua tabel
# =============================================================
print_db_state() {
  local label="$1"
  echo "  ┌─────────────────────────────────────────────────────┐"
  printf  "  │  %-51s│\n" "$label"
  echo "  ├──────────────────────────────┬──────────────────────┤"
  printf  "  │  %-28s  │  %-18s  │\n" "Tabel" "Row Count"
  echo "  ├──────────────────────────────┼──────────────────────┤"

  # Tabel-tabel dari schema (urut: statis dulu, volatile belakang)
  local tables=(
    "categories"
    "products"
    "users"
    "addresses"
    "carts"
    "cart_items"
    "refresh_tokens"
    "orders"
    "order_items"
  )

  for tbl in "${tables[@]}"; do
    local count
    count=$(psql "$DB" -t -A -c "SELECT COUNT(*) FROM ${tbl};" 2>/dev/null || echo "ERR")
    printf "  │  %-28s  │  %-18s  │\n" "$tbl" "$count"
  done

  echo "  └──────────────────────────────┴──────────────────────┘"
  echo ""
}

# =============================================================
# SNAPSHOT SEBELUM RESET
# =============================================================
echo "  📸 DB STATE — SEBELUM RESET"
print_db_state "BEFORE"

# ── Cek state DB sebelum reset ────────────────────────────────
PENDING_COUNT=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM orders WHERE status = 'pending_payment';" 2>/dev/null || echo "0")

ORDER_ITEMS_COUNT=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM order_items;" 2>/dev/null || echo "0")

CART_ITEMS_COUNT=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM cart_items;" 2>/dev/null || echo "0")

K6_USERS_COUNT=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM users WHERE email LIKE '%@k6test.dev';" 2>/dev/null || echo "0")

echo "  📊 Detail state (untuk logika skip):"
echo "     pending_payment orders : $PENDING_COUNT"
echo "     order_items            : $ORDER_ITEMS_COUNT"
echo "     cart_items             : $CART_ITEMS_COUNT"
echo "     k6test.dev users       : $K6_USERS_COUNT"
echo ""

# Tentukan apakah perlu reset orders + reseed
SKIP_ORDER_RESET=false
if [ "$PENDING_COUNT" -ge 2000 ] \
  && [ "$ORDER_ITEMS_COUNT" -eq 0 ] \
  && [ "$CART_ITEMS_COUNT" -eq 0 ] \
  && [ "$K6_USERS_COUNT" -eq 0 ]; then
  SKIP_ORDER_RESET=true
  echo "  ✅ Orders sudah valid ($PENDING_COUNT pending), tidak ada sisa k6 data."
  echo "     Skip DELETE orders + reseed — tidak ada yang berubah."
  echo ""
fi

# ── BLOK 1: Cleanup selalu jalan (kecuali orders kalau skip) ──
if [ "$SKIP_ORDER_RESET" = true ]; then
  psql "$DB" -q << 'SQL'
    DELETE FROM order_items;
    DELETE FROM cart_items;
    DELETE FROM refresh_tokens;
    DELETE FROM products WHERE name LIKE 'k6 Test Product %';
    UPDATE carts SET status = 'active';
    UPDATE products SET stock = 9999 WHERE stock < 9999;
    DELETE FROM carts
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@k6test.dev');
    DELETE FROM users WHERE email LIKE '%@k6test.dev';
SQL
else
  psql "$DB" -q << 'SQL'
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM cart_items;
    DELETE FROM refresh_tokens;
    DELETE FROM products WHERE name LIKE 'k6 Test Product %';
    UPDATE carts SET status = 'active';
    UPDATE products SET stock = 9999 WHERE stock < 9999;
    DELETE FROM carts
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@k6test.dev');
    DELETE FROM users WHERE email LIKE '%@k6test.dev';
SQL
fi

if [ $? -ne 0 ]; then
  echo "❌  Cleanup GAGAL. Cek koneksi DB atau string koneksi."
  exit 1
fi

# ── BLOK 2: Seed orders (hanya kalau perlu) ───────────────────
if [ "$SKIP_ORDER_RESET" = false ]; then
  echo "  🌱 Seeding orders..."

  psql "$DB" -q << 'SQL'

    -- pending_payment — plain JOIN, LIMIT 2000
    INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                        shipping_address, payment_method, shipping_method,
                        order_number, created_at, updated_at)
    SELECT
      gen_random_uuid(), u.id, a.id, 'pending_payment',
      130000, 13000, 15000, 158000,
      '{"city":"Jakarta"}'::jsonb, 'bank_transfer', 'regular',
      'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || a.id::text || random()::text), 1, 12),
      NOW() - (random() * interval '2 days'), NOW()
    FROM users u
    JOIN addresses a ON a.user_id = u.id
    WHERE u.role = 'USER' AND u.email NOT LIKE '%@k6test.dev'
    ORDER BY random()
    LIMIT 2000;

    -- confirmed — DISTINCT ON, LIMIT 500
    INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                        shipping_address, payment_method, shipping_method,
                        order_number, created_at, updated_at)
    SELECT
      gen_random_uuid(), u.id, a.id, 'confirmed',
      150000, 15000, 15000, 180000,
      '{"city":"Jakarta"}'::jsonb, 'bank_transfer', 'regular',
      'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
      NOW() - (random() * interval '5 days'), NOW()
    FROM users u
    JOIN (SELECT DISTINCT ON (user_id) id, user_id FROM addresses ORDER BY user_id, created_at ASC) a
      ON a.user_id = u.id
    WHERE u.role = 'USER' AND u.email NOT LIKE '%@k6test.dev'
    ORDER BY random()
    LIMIT 500;

    -- processing — DISTINCT ON, LIMIT 500
    INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                        shipping_address, payment_method, shipping_method,
                        order_number, created_at, updated_at)
    SELECT
      gen_random_uuid(), u.id, a.id, 'processing',
      175000, 17500, 15000, 207500,
      '{"city":"Jakarta"}'::jsonb, 'qris', 'express',
      'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
      NOW() - (random() * interval '7 days'), NOW()
    FROM users u
    JOIN (SELECT DISTINCT ON (user_id) id, user_id FROM addresses ORDER BY user_id, created_at ASC) a
      ON a.user_id = u.id
    WHERE u.role = 'USER' AND u.email NOT LIKE '%@k6test.dev'
    ORDER BY random()
    LIMIT 500;

    -- shipped — DISTINCT ON, LIMIT 500
    INSERT INTO orders (id, user_id, address_id, status, subtotal, tax, shipping_cost, total,
                        shipping_address, payment_method, shipping_method,
                        order_number, created_at, updated_at)
    SELECT
      gen_random_uuid(), u.id, a.id, 'shipped',
      200000, 20000, 15000, 235000,
      '{"city":"Jakarta"}'::jsonb, 'cod', 'regular',
      'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(u.id || random()::text), 1, 12),
      NOW() - (random() * interval '10 days'), NOW()
    FROM users u
    JOIN (SELECT DISTINCT ON (user_id) id, user_id FROM addresses ORDER BY user_id, created_at ASC) a
      ON a.user_id = u.id
    WHERE u.role = 'USER' AND u.email NOT LIKE '%@k6test.dev'
    ORDER BY random()
    LIMIT 500;

SQL

  if [ $? -ne 0 ]; then
    echo "❌  Seed orders GAGAL."
    exit 1
  fi
fi

# ── Redis flush ────────────────────────────────────────────────
redis-cli FLUSHDB 2>/dev/null && echo "🗑️  Redis cache cleared." || echo "⚠️  Redis tidak jalan, skip flush."

# =============================================================
# SNAPSHOT SESUDAH RESET
# =============================================================
echo ""
echo "  📸 DB STATE — SESUDAH RESET"
print_db_state "AFTER"

# ── Verifikasi angka penting ───────────────────────────────────
AFTER_PENDING=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM orders WHERE status = 'pending_payment';" 2>/dev/null || echo "0")
AFTER_CONFIRMED=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM orders WHERE status = 'confirmed';" 2>/dev/null || echo "0")
AFTER_PROCESSING=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM orders WHERE status = 'processing';" 2>/dev/null || echo "0")
AFTER_SHIPPED=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM orders WHERE status = 'shipped';" 2>/dev/null || echo "0")
AFTER_CART_ITEMS=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM cart_items;" 2>/dev/null || echo "0")
AFTER_ORDER_ITEMS=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM order_items;" 2>/dev/null || echo "0")
AFTER_REFRESH=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM refresh_tokens;" 2>/dev/null || echo "0")
AFTER_K6_USERS=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM users WHERE email LIKE '%@k6test.dev';" 2>/dev/null || echo "0")
AFTER_K6_PRODUCTS=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM products WHERE name LIKE 'k6 Test Product %';" 2>/dev/null || echo "0")
AFTER_STOCK_LOW=$(psql "$DB" -t -A -c \
  "SELECT COUNT(*) FROM products WHERE stock < 9999;" 2>/dev/null || echo "0")

echo "  🔍 Verifikasi target state:"
echo ""

check_val() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  local op="$4"   # "eq", "gte", "zero"

  local ok=false
  case "$op" in
    eq)   [ "$actual" -eq "$expected" ]  2>/dev/null && ok=true ;;
    gte)  [ "$actual" -ge "$expected" ]  2>/dev/null && ok=true ;;
    zero) [ "$actual" -eq 0 ]            2>/dev/null && ok=true ;;
  esac

  if [ "$ok" = true ]; then
    printf "     ✅  %-38s %s\n" "$label" "$actual"
  else
    printf "     ❌  %-38s %s  (expected: %s)\n" "$label" "$actual" "$expected"
  fi
}

check_val "pending_payment orders"      "$AFTER_PENDING"     "2000" "gte"
check_val "confirmed orders"            "$AFTER_CONFIRMED"   "500"  "gte"
check_val "processing orders"           "$AFTER_PROCESSING"  "500"  "gte"
check_val "shipped orders"              "$AFTER_SHIPPED"     "500"  "gte"
check_val "cart_items (harus 0)"        "$AFTER_CART_ITEMS"  "0"    "zero"
check_val "order_items (harus 0)"       "$AFTER_ORDER_ITEMS" "0"    "zero"
check_val "refresh_tokens (harus 0)"    "$AFTER_REFRESH"     "0"    "zero"
check_val "k6test.dev users (harus 0)"  "$AFTER_K6_USERS"    "0"    "zero"
check_val "k6 test products (harus 0)"  "$AFTER_K6_PRODUCTS" "0"    "zero"
check_val "products stock < 9999 (0)"   "$AFTER_STOCK_LOW"   "0"    "zero"

echo ""

# ── Summary ────────────────────────────────────────────────────
echo "============================================"
echo "  reset_db.sh v5 — selesai"
echo "============================================"
echo ""
echo "  [OK] order_items, cart_items           -> dihapus"
echo "  [OK] refresh_tokens                    -> semua dihapus"
echo "  [OK] k6 test products (orphan S-05)    -> dihapus"
echo "  [OK] carts                             -> status reset ke active"
echo "  [OK] products                          -> stock reset ke 9999"
echo "  [OK] k6test.dev users + carts          -> dihapus"
if [ "$SKIP_ORDER_RESET" = true ]; then
  echo "  [SKIP] orders                          -> sudah valid, tidak diubah"
else
  echo "  [OK] orders                            -> di-reset + seed 2000 pending + 500x3"
fi
echo "  [OK] Redis                             -> FLUSHDB"
echo ""
echo "  DB + Redis siap untuk run berikutnya."
echo "============================================"
echo ""