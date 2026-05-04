-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('livret', 'pea', 'cto', 'av', 'autre');

-- CreateEnum
CREATE TYPE "holding_kind" AS ENUM ('etf', 'action', 'autre');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('inflow', 'outflow');

-- CreateEnum
CREATE TYPE "lot_type" AS ENUM ('buy', 'sell');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "type" "account_type" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "cash_balance" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "kind" "holding_kind" NOT NULL,
    "ticker" TEXT,
    "isin" TEXT,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "quantity" DECIMAL NOT NULL,
    "avg_cost" DECIMAL NOT NULL,
    "last_price" DECIMAL NOT NULL DEFAULT 0,
    "last_price_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_lots" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "holding_id" TEXT NOT NULL,
    "type" "lot_type" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "price_unit" DECIMAL NOT NULL,
    "fees" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hypotheses" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "salaire_net" DECIMAL DEFAULT 3700,
    "ticket_resto_jour" DECIMAL DEFAULT 14,
    "part_employeur_tr" DECIMAL DEFAULT 0.6,
    "jours_travailles" DECIMAL DEFAULT 20,
    "navigo_cout" DECIMAL DEFAULT 90,
    "part_employeur_navigo" DECIMAL DEFAULT 0.5,
    "mutuelle_economie" DECIMAL DEFAULT 30,
    "loyer" DECIMAL DEFAULT 1125,
    "courses" DECIMAL DEFAULT 200,
    "transport" DECIMAL DEFAULT 45,
    "autres_charges" DECIMAL DEFAULT 150,
    "sorties" DECIMAL DEFAULT 250,
    "divers" DECIMAL DEFAULT 120,
    "voyage_mois" DECIMAL DEFAULT 600,
    "credit_mensuel" DECIMAL DEFAULT 250,
    "date_debut_credit" TEXT DEFAULT '01/2027',
    "matelas_cible" DECIMAL DEFAULT 10000,
    "perf_etf_annuelle" DECIMAL DEFAULT 0.07,
    "augmentation_salaire" DECIMAL DEFAULT 0.03,
    "part_etf_monde" DECIMAL DEFAULT 0.8,
    "part_opportunites" DECIMAL DEFAULT 0.2,
    "economie_remote_mois" DECIMAL DEFAULT 1000,
    "mois_remote_an" DECIMAL DEFAULT 6,
    "revenu_freelance_mois" DECIMAL DEFAULT 300,
    "horizon_years" SMALLINT NOT NULL DEFAULT 5,
    "objectif" DECIMAL NOT NULL DEFAULT 100000,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hypotheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "net_reel" DECIMAL DEFAULT 3700,
    "pouvoir_achat" DECIMAL DEFAULT 3943,
    "epargne_mois" DECIMAL DEFAULT 1210,
    "capital_projete" DECIMAL DEFAULT 145738,
    "objectif" DECIMAL DEFAULT 100000,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_tracking" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "month_num" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month_label" TEXT NOT NULL,
    "net" DECIMAL NOT NULL,
    "avantages" DECIMAL NOT NULL DEFAULT 243,
    "depenses" DECIMAL NOT NULL DEFAULT 2490,
    "credit" DECIMAL NOT NULL DEFAULT 0,
    "remote" DECIMAL NOT NULL DEFAULT 0,
    "freelance" DECIMAL NOT NULL DEFAULT 0,
    "epargne_mois" DECIMAL NOT NULL,
    "perf_marche" DECIMAL NOT NULL DEFAULT 0,
    "epargne_cumul" DECIMAL NOT NULL,
    "capital_total" DECIMAL NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "occurred_on" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "type" "transaction_type" NOT NULL,
    "category" TEXT NOT NULL,
    "is_imprevu" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holdings_user_account_idx" ON "holdings"("user_id", "account_id");

-- CreateIndex
CREATE INDEX "holding_lots_user_holding_idx" ON "holding_lots"("user_id", "holding_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "hypotheses_user_id_key" ON "hypotheses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpis_user_id_key" ON "kpis"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_tracking_user_id_month_num_year_key" ON "monthly_tracking"("user_id", "month_num", "year");

-- CreateIndex
CREATE INDEX "transactions_user_date_idx" ON "transactions"("user_id", "occurred_on" DESC);

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_lots" ADD CONSTRAINT "holding_lots_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================
-- CHECK constraints (manually appended — Prisma DSL does not model CHECK natively)
-- Reproduces brownfield apps/web/supabase-schema.sql invariants verbatim.
-- A buggy oRPC handler in epics 1-8 cannot land negative monetary values; Postgres
-- rejects them at the row level as defense-in-depth alongside the Zod input
-- validators in @pekulo/validators.
-- ============================================================

ALTER TABLE "transactions"   ADD CONSTRAINT "transactions_amount_check"     CHECK ("amount" >= 0);
ALTER TABLE "accounts"       ADD CONSTRAINT "accounts_cash_balance_check"   CHECK ("cash_balance" >= 0);
ALTER TABLE "holdings"       ADD CONSTRAINT "holdings_quantity_check"       CHECK ("quantity" >= 0);
ALTER TABLE "holdings"       ADD CONSTRAINT "holdings_avg_cost_check"       CHECK ("avg_cost" >= 0);
ALTER TABLE "holdings"       ADD CONSTRAINT "holdings_last_price_check"     CHECK ("last_price" >= 0);
ALTER TABLE "holding_lots"   ADD CONSTRAINT "holding_lots_quantity_check"   CHECK ("quantity" > 0);
ALTER TABLE "holding_lots"   ADD CONSTRAINT "holding_lots_price_unit_check" CHECK ("price_unit" >= 0);
ALTER TABLE "holding_lots"   ADD CONSTRAINT "holding_lots_fees_check"       CHECK ("fees" >= 0);

-- ============================================================
-- RLS policies (manually appended — Prisma does not introspect Postgres policies)
-- The 3-vs-4 split is preserved verbatim from apps/web/supabase-schema.sql:
--   - kpis / monthly_tracking / hypotheses ship without DELETE policies
--   - transactions / accounts / holdings / holding_lots have the full quartet
-- ============================================================

ALTER TABLE "kpis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hypotheses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holdings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holding_lots" ENABLE ROW LEVEL SECURITY;

-- kpis (3 policies — no DELETE)
CREATE POLICY "Users can view their own KPIs" ON "kpis"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KPIs" ON "kpis"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KPIs" ON "kpis"
  FOR UPDATE USING (auth.uid() = user_id);

-- monthly_tracking (3 policies — no DELETE)
CREATE POLICY "Users can view their own tracking" ON "monthly_tracking"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tracking" ON "monthly_tracking"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tracking" ON "monthly_tracking"
  FOR UPDATE USING (auth.uid() = user_id);

-- hypotheses (3 policies — no DELETE)
CREATE POLICY "Users can view their own hypotheses" ON "hypotheses"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own hypotheses" ON "hypotheses"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hypotheses" ON "hypotheses"
  FOR UPDATE USING (auth.uid() = user_id);

-- transactions (4 policies)
CREATE POLICY "Users can view their own transactions" ON "transactions"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON "transactions"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON "transactions"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON "transactions"
  FOR DELETE USING (auth.uid() = user_id);

-- accounts (4 policies)
CREATE POLICY "Users can view their own accounts" ON "accounts"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own accounts" ON "accounts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own accounts" ON "accounts"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own accounts" ON "accounts"
  FOR DELETE USING (auth.uid() = user_id);

-- holdings (4 policies)
CREATE POLICY "Users can view their own holdings" ON "holdings"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own holdings" ON "holdings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own holdings" ON "holdings"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own holdings" ON "holdings"
  FOR DELETE USING (auth.uid() = user_id);

-- holding_lots (4 policies)
CREATE POLICY "Users can view their own lots" ON "holding_lots"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lots" ON "holding_lots"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lots" ON "holding_lots"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own lots" ON "holding_lots"
  FOR DELETE USING (auth.uid() = user_id);

-- FK to auth.users for ON DELETE CASCADE behaviour (re-asserted after Prisma's
-- table creation; Prisma 7 cannot model cross-schema FKs to the supabase auth
-- schema natively, so we rebuild them here).
ALTER TABLE "kpis"             ADD CONSTRAINT "kpis_user_id_fkey"             FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "monthly_tracking" ADD CONSTRAINT "monthly_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "hypotheses"       ADD CONSTRAINT "hypotheses_user_id_fkey"       FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "transactions"     ADD CONSTRAINT "transactions_user_id_fkey"     FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "accounts"         ADD CONSTRAINT "accounts_user_id_fkey"         FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "holdings"         ADD CONSTRAINT "holdings_user_id_fkey"         FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "holding_lots"     ADD CONSTRAINT "holding_lots_user_id_fkey"     FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
