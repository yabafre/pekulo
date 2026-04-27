-- Initial schema baseline.
-- Mirrors the production state before migrations were introduced.
-- For an existing linked database, mark this as already applied:
--   supabase migration repair --status applied 20260101000000

-- ============================================================
-- KPIs (legacy — currently not consumed by the app, kept for compat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  net_reel NUMERIC DEFAULT 3700,
  pouvoir_achat NUMERIC DEFAULT 3943,
  epargne_mois NUMERIC DEFAULT 1210,
  capital_projete NUMERIC DEFAULT 145738,
  objectif NUMERIC DEFAULT 100000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KPIs"
  ON public.kpis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KPIs"
  ON public.kpis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KPIs"
  ON public.kpis FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Monthly tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monthly_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_num INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month_label TEXT NOT NULL,
  net NUMERIC NOT NULL,
  avantages NUMERIC NOT NULL DEFAULT 243,
  depenses NUMERIC NOT NULL DEFAULT 2490,
  credit NUMERIC NOT NULL DEFAULT 0,
  remote NUMERIC NOT NULL DEFAULT 0,
  freelance NUMERIC NOT NULL DEFAULT 0,
  epargne_mois NUMERIC NOT NULL,
  perf_marche NUMERIC NOT NULL DEFAULT 0,
  epargne_cumul NUMERIC NOT NULL,
  capital_total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_num, year)
);

ALTER TABLE public.monthly_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracking"
  ON public.monthly_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tracking"
  ON public.monthly_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tracking"
  ON public.monthly_tracking FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Hypotheses (user-editable parameters)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salaire_net NUMERIC DEFAULT 3700,
  ticket_resto_jour NUMERIC DEFAULT 14,
  part_employeur_tr NUMERIC DEFAULT 0.6,
  jours_travailles NUMERIC DEFAULT 20,
  navigo_cout NUMERIC DEFAULT 90,
  part_employeur_navigo NUMERIC DEFAULT 0.5,
  mutuelle_economie NUMERIC DEFAULT 30,
  loyer NUMERIC DEFAULT 1125,
  courses NUMERIC DEFAULT 200,
  transport NUMERIC DEFAULT 45,
  autres_charges NUMERIC DEFAULT 150,
  sorties NUMERIC DEFAULT 250,
  divers NUMERIC DEFAULT 120,
  voyage_mois NUMERIC DEFAULT 600,
  credit_mensuel NUMERIC DEFAULT 250,
  date_debut_credit TEXT DEFAULT '01/2027',
  matelas_cible NUMERIC DEFAULT 10000,
  perf_etf_annuelle NUMERIC DEFAULT 0.07,
  augmentation_salaire NUMERIC DEFAULT 0.03,
  part_etf_monde NUMERIC DEFAULT 0.8,
  part_opportunites NUMERIC DEFAULT 0.2,
  economie_remote_mois NUMERIC DEFAULT 1000,
  mois_remote_an NUMERIC DEFAULT 6,
  revenu_freelance_mois NUMERIC DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hypotheses"
  ON public.hypotheses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own hypotheses"
  ON public.hypotheses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hypotheses"
  ON public.hypotheses FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Transactions
-- ============================================================
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('inflow', 'outflow');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  type transaction_type NOT NULL,
  category TEXT NOT NULL,
  is_imprevu BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, occurred_on DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions"
  ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Accounts + Holdings
-- ============================================================
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('livret', 'pea', 'cto', 'av', 'autre');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE holding_kind AS ENUM ('etf', 'action', 'autre');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type account_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  cash_balance NUMERIC NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind holding_kind NOT NULL,
  ticker TEXT,
  isin TEXT,
  label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  avg_cost NUMERIC NOT NULL CHECK (avg_cost >= 0),
  last_price NUMERIC NOT NULL DEFAULT 0 CHECK (last_price >= 0),
  last_price_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holdings_user_account_idx
  ON public.holdings (user_id, account_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
CREATE POLICY "Users can view their own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
CREATE POLICY "Users can insert their own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
CREATE POLICY "Users can update their own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;
CREATE POLICY "Users can delete their own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own holdings" ON public.holdings;
CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.holdings;
CREATE POLICY "Users can insert their own holdings" ON public.holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own holdings" ON public.holdings;
CREATE POLICY "Users can update their own holdings" ON public.holdings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.holdings;
CREATE POLICY "Users can delete their own holdings" ON public.holdings FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Holding lots
-- ============================================================
DO $$ BEGIN
  CREATE TYPE lot_type AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.holding_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  type lot_type NOT NULL,
  occurred_on DATE NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price_unit NUMERIC NOT NULL CHECK (price_unit >= 0),
  fees NUMERIC NOT NULL DEFAULT 0 CHECK (fees >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holding_lots_user_holding_idx
  ON public.holding_lots (user_id, holding_id, occurred_on);

ALTER TABLE public.holding_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own lots" ON public.holding_lots;
CREATE POLICY "Users can view their own lots" ON public.holding_lots FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own lots" ON public.holding_lots;
CREATE POLICY "Users can insert their own lots" ON public.holding_lots FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own lots" ON public.holding_lots;
CREATE POLICY "Users can update their own lots" ON public.holding_lots FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own lots" ON public.holding_lots;
CREATE POLICY "Users can delete their own lots" ON public.holding_lots FOR DELETE USING (auth.uid() = user_id);
