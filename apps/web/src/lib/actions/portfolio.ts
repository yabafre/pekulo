"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountSchema, holdingSchema, idSchema, updatePriceSchema } from "@/lib/schemas/portfolio";
import { portfolioTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";
import type {
  Account,
  AccountType,
  Currency,
  Holding,
  HoldingKind,
  RefreshSummary,
} from "@/lib/types";
import { fetchPriceQuote, PriceError } from "@/lib/services/prices";
import { YahooError } from "@/lib/services/yahoo-finance";

const accountRow = (row: Record<string, unknown>): Account => ({
  id: String(row.id),
  label: String(row.label),
  type: row.type as AccountType,
  currency: (row.currency as Currency) ?? "EUR",
  cashBalance: Number(row.cash_balance),
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
});

const holdingRow = (row: Record<string, unknown>): Holding => ({
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

function bumpPaths() {
  revalidatePath("/dashboard/portefeuille");
  revalidatePath("/dashboard");
}

export const getAccounts = defineAction<void, Account[], ActionContext>({
  name: "getAccounts",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(accountRow);
  },
});

export const getHoldings = defineAction<void, Holding[], ActionContext>({
  name: "getHoldings",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(holdingRow);
  },
});

export const saveAccount = defineAction<z.infer<typeof accountSchema>, Account, ActionContext>({
  name: "saveAccount",
  input: accountSchema,
  tags: [portfolioTags.accounts()],
  handler: async ({ input, ctx }) => {
    const payload = {
      user_id: ctx.userId,
      label: input.label,
      type: input.type,
      currency: input.currency,
      cash_balance: input.cashBalance,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = input.id
      ? await ctx.supabase
          .from("accounts")
          .update(payload)
          .eq("id", input.id)
          .eq("user_id", ctx.userId)
          .select("*")
          .single()
      : await ctx.supabase.from("accounts").insert(payload).select("*").single();
    if (error) throw error;
    bumpPaths();
    return accountRow(data);
  },
});

export const deleteAccount = defineAction<z.infer<typeof idSchema>, { ok: true }, ActionContext>({
  name: "deleteAccount",
  input: idSchema,
  tags: [portfolioTags.accounts(), portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from("accounts")
      .delete()
      .eq("id", input.id)
      .eq("user_id", ctx.userId);
    if (error) throw error;
    bumpPaths();
    return { ok: true as const };
  },
});

export const saveHolding = defineAction<z.infer<typeof holdingSchema>, Holding, ActionContext>({
  name: "saveHolding",
  input: holdingSchema,
  tags: [portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const payload = {
      user_id: ctx.userId,
      account_id: input.accountId,
      kind: input.kind,
      ticker: input.ticker ?? null,
      isin: input.isin ?? null,
      label: input.label,
      currency: input.currency,
      quantity: input.quantity,
      avg_cost: input.avgCost,
      last_price: input.lastPrice,
      last_price_at: input.lastPriceAt ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = input.id
      ? await ctx.supabase
          .from("holdings")
          .update(payload)
          .eq("id", input.id)
          .eq("user_id", ctx.userId)
          .select("*")
          .single()
      : await ctx.supabase.from("holdings").insert(payload).select("*").single();
    if (error) throw error;
    bumpPaths();
    return holdingRow(data);
  },
});

export const deleteHolding = defineAction<z.infer<typeof idSchema>, { ok: true }, ActionContext>({
  name: "deleteHolding",
  input: idSchema,
  tags: [portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from("holdings")
      .delete()
      .eq("id", input.id)
      .eq("user_id", ctx.userId);
    if (error) throw error;
    bumpPaths();
    return { ok: true as const };
  },
});

export const updateHoldingPrice = defineAction<
  z.infer<typeof updatePriceSchema>,
  Holding,
  ActionContext
>({
  name: "updateHoldingPrice",
  input: updatePriceSchema,
  tags: [portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from("holdings")
      .update({
        last_price: input.lastPrice,
        last_price_at: input.lastPriceAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("user_id", ctx.userId)
      .select("*")
      .single();
    if (error) throw error;
    bumpPaths();
    return holdingRow(data);
  },
});

async function refreshOne(ctx: ActionContext, holding: Holding): Promise<Holding> {
  const quote = await fetchPriceQuote({
    ticker: holding.ticker,
    currency: holding.currency,
    kind: holding.kind,
  });
  const { data, error } = await ctx.supabase
    .from("holdings")
    .update({
      last_price: quote.price,
      last_price_at: quote.marketTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holding.id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();
  if (error) throw error;
  return holdingRow(data);
}

export const refreshHoldingPrice = defineAction<z.infer<typeof idSchema>, Holding, ActionContext>({
  name: "refreshHoldingPrice",
  input: idSchema,
  tags: [portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { data: row, error: readErr } = await ctx.supabase
      .from("holdings")
      .select("*")
      .eq("id", input.id)
      .eq("user_id", ctx.userId)
      .single();
    if (readErr) throw readErr;
    const updated = await refreshOne(ctx, holdingRow(row));
    bumpPaths();
    return updated;
  },
});

export const refreshAllPrices = defineAction<void, RefreshSummary, ActionContext>({
  name: "refreshAllPrices",
  input: z.void(),
  tags: [portfolioTags.holdings()],
  handler: async ({ ctx }) => {
    const { data: rows, error } = await ctx.supabase
      .from("holdings")
      .select("*")
      .eq("user_id", ctx.userId);
    if (error) throw error;

    const holdings = (rows ?? []).map(holdingRow);
    let updated = 0;
    const failed: RefreshSummary["failed"] = [];

    for (const h of holdings) {
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential by design: providers rate-limit per host
        await refreshOne(ctx, h);
        updated += 1;
      } catch (err) {
        const reason =
          err instanceof YahooError
            ? mapReason(err.code)
            : err instanceof PriceError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Erreur inconnue";
        failed.push({ id: h.id, label: h.label, reason });
      }
      // eslint-disable-next-line no-await-in-loop -- 200 ms throttle between provider calls
      await new Promise((r) => setTimeout(r, 200));
    }

    bumpPaths();
    return { updated, failed };
  },
});

function mapReason(code: YahooError["code"]): string {
  switch (code) {
    case "missing-ticker":
      return "Ticker manquant";
    case "invalid-ticker":
      return "Ticker invalide";
    case "rate-limited":
      return "Rate-limited";
    case "no-price":
      return "Aucun prix disponible";
    case "format":
      return "Format inattendu";
    case "network":
      return "Réseau";
  }
}
