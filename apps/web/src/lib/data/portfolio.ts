import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Currency, Holding, HoldingKind } from "@/lib/types";

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
