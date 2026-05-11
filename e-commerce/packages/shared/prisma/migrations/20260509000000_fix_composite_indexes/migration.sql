DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";
DROP INDEX IF EXISTS "refresh_tokens_token_hash_idx";
CREATE INDEX "refresh_tokens_user_id_revoked_idx" ON "refresh_tokens" ("user_id", "revoked");

DROP INDEX IF EXISTS "orders_user_id_idx";
CREATE INDEX "orders_user_id_created_at_idx" ON "orders" ("user_id", "created_at" DESC);
