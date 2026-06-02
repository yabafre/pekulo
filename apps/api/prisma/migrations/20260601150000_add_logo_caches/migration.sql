-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-10: logo caches (merchant + provider). REFERENCE DATA — no user_id,
-- no FK to auth.users, NO RLS (not user-scoped). See logos.prisma header.

CREATE TABLE IF NOT EXISTS "merchant_logo_cache" (
    "merchant_key" TEXT NOT NULL,
    "logo_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_logo_cache_pkey" PRIMARY KEY ("merchant_key")
);

CREATE TABLE IF NOT EXISTS "provider_logo_cache" (
    "provider_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_logo_cache_pkey" PRIMARY KEY ("provider_id")
);
