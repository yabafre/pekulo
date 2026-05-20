-- 4-1-realestate-domain — net-new realestate aggregate. 4 tables:
--   real_estate                (CRUD parent — RLS quartet)
--   real_estate_mortgage       (1:1 child — RLS quartet, UNIQUE on real_estate_id)
--   real_estate_rental         (1:1 child — RLS quartet, UNIQUE on real_estate_id)
--   real_estate_valuations     (append-only audit per ADR-0001 — RLS INSERT+SELECT only)
--
-- All FKs to parent use ON DELETE CASCADE so deleteProperty cascades to children.
-- All FKs to auth.users(id) use ON DELETE CASCADE so account deletion (story 11-2)
-- removes every property + child row in one shot.
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — real_estate (CRUD parent)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate" (
    "id"                 TEXT NOT NULL,
    "user_id"            UUID NOT NULL,
    "label"              TEXT NOT NULL CHECK (char_length("label") BETWEEN 1 AND 120),
    "property_type"      TEXT NOT NULL CHECK ("property_type" IN ('residence-principale', 'locatif', 'autre')),
    "current_valuation"  NUMERIC NOT NULL CHECK ("current_valuation" >= 0),
    "last_valued_on"     DATE NOT NULL,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "real_estate"
  ADD CONSTRAINT "real_estate_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_user_created_idx"
  ON "real_estate" ("user_id", "created_at" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — real_estate_mortgage (1:1 child)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_mortgage" (
    "id"                     TEXT NOT NULL,
    "user_id"                UUID NOT NULL,
    "real_estate_id"         TEXT NOT NULL,
    "outstanding_principal"  NUMERIC NOT NULL CHECK ("outstanding_principal" >= 0),
    "annual_rate"            NUMERIC NOT NULL CHECK ("annual_rate" >= 0 AND "annual_rate" <= 1),
    "monthly_payment"        NUMERIC NOT NULL CHECK ("monthly_payment" >= 0),
    "term_months"            INTEGER NOT NULL CHECK ("term_months" BETWEEN 1 AND 600),
    "start_date"             DATE NOT NULL,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_mortgage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "real_estate_mortgage_real_estate_id_key" UNIQUE ("real_estate_id")
);

ALTER TABLE "real_estate_mortgage"
  ADD CONSTRAINT "real_estate_mortgage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_mortgage"
  ADD CONSTRAINT "real_estate_mortgage_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_mortgage_user_idx"
  ON "real_estate_mortgage" ("user_id");

-- ───────────────────────────────────────────────────────────────────────────
-- Step 3 — real_estate_rental (1:1 child)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_rental" (
    "id"               TEXT NOT NULL,
    "user_id"          UUID NOT NULL,
    "real_estate_id"   TEXT NOT NULL,
    "monthly_rent"     NUMERIC NOT NULL CHECK ("monthly_rent" >= 0),
    "monthly_charges"  NUMERIC NOT NULL CHECK ("monthly_charges" >= 0),
    "furnished"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_rental_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "real_estate_rental_real_estate_id_key" UNIQUE ("real_estate_id")
);

ALTER TABLE "real_estate_rental"
  ADD CONSTRAINT "real_estate_rental_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_rental"
  ADD CONSTRAINT "real_estate_rental_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_rental_user_idx"
  ON "real_estate_rental" ("user_id");

-- ───────────────────────────────────────────────────────────────────────────
-- Step 4 — real_estate_valuations (append-only audit sister per ADR-0001)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_valuations" (
    "id"               TEXT NOT NULL,
    "user_id"          UUID NOT NULL,
    "real_estate_id"   TEXT NOT NULL,
    "amount"           NUMERIC NOT NULL CHECK ("amount" >= 0),
    "valued_on"        DATE NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_valuations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "real_estate_valuations"
  ADD CONSTRAINT "real_estate_valuations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_valuations"
  ADD CONSTRAINT "real_estate_valuations_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_valuations_user_property_valued_idx"
  ON "real_estate_valuations" ("user_id", "real_estate_id", "valued_on" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 5 — RLS quartet on the 3 CRUD tables (real_estate, mortgage, rental)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "real_estate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate" ON "real_estate"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate" ON "real_estate"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate" ON "real_estate"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate" ON "real_estate"
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE "real_estate_mortgage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate mortgage" ON "real_estate_mortgage"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate mortgage" ON "real_estate_mortgage"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate mortgage" ON "real_estate_mortgage"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate mortgage" ON "real_estate_mortgage"
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE "real_estate_rental" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate rental" ON "real_estate_rental"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate rental" ON "real_estate_rental"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate rental" ON "real_estate_rental"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate rental" ON "real_estate_rental"
  FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 6 — RLS audit variant on real_estate_valuations (INSERT + SELECT only)
-- per ADR-0001 — append-only enforcement at the SQL layer. UPDATE / DELETE
-- intentionally omitted; deletion only via FK cascade from the parent property.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "real_estate_valuations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate valuations" ON "real_estate_valuations"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate valuations" ON "real_estate_valuations"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
