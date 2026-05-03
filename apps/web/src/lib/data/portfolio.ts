import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeSnapshotFx, type PortfolioSnapshotFx } from "@/lib/derive-portfolio-fx";
import { getRates } from "@/lib/services/fx";
import type { Account, AccountType, Currency, Holding, HoldingKind } from "@/lib/types";

const accountRowToAccount = (row: Record<string, unknown>): Account => ({
  id: String(row.id),
  label: String(row.label),
  type: row.type as AccountType,
  currency: (row.currency as Currency) ?? "EUR",
  cashBalance: Number(row.cash_balance),
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
});

const holdingRowToHolding = (row: Record<string, unknown>): Holding => ({
  id: String(row.id),
  accountId: String(row.account_id),
  kind: row.kind as HoldingKind,
  ticker: row.ticker != null ? String(row.ticker) : null,
  isin: row.isin != null ? String(row.isin) : null,
  label: String(row.label),
  currency: (row.currency as Currency) ?? "EUR",
  quantity: Number(row.quantity),
  avgCost: Number(row.avg_cost),
  lastPrice: Number(row.last_price),
  lastPriceAt: row.last_price_at != null ? String(row.last_price_at) : null,
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
});

export async function readAccounts(): Promise<Account[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(accountRowToAccount);
  } catch {
    return [];
  }
}

export async function readHoldings(): Promise<Holding[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(holdingRowToHolding);
  } catch {
    return [];
  }
}

export async function readPortfolioSnapshot(): Promise<PortfolioSnapshotFx> {
  const [accounts, holdings] = await Promise.all([readAccounts(), readHoldings()]);

  // FX rates are best-effort — fall back to 1:1 on any failure.
  let rates = null;
  try {
    rates = await getRates("EUR");
  } catch {
    rates = null;
  }

  return computeSnapshotFx(accounts, holdings, rates, "EUR");
}
