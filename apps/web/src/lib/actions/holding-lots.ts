"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lotIdSchema, lotInputSchema, lotListFilterSchema } from "@/lib/schemas/holding-lots";
import { lotsTags, portfolioTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";
import type { HoldingLot, LotType } from "@/lib/types";
import { deriveFromLots } from "@/lib/derive-lots";

const rowToLot = (row: Record<string, unknown>): HoldingLot => ({
  id: String(row.id),
  holdingId: String(row.holding_id),
  type: row.type as LotType,
  occurredOn: String(row.occurred_on),
  quantity: Number(row.quantity),
  priceUnit: Number(row.price_unit),
  fees: Number(row.fees),
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
});

function bumpPaths() {
  revalidatePath("/dashboard/portefeuille");
  revalidatePath("/dashboard");
}

/**
 * Recompute holdings.{quantity, avg_cost} from all lots and persist.
 * Called after every lot mutation.
 */
async function recomputeHolding(ctx: ActionContext, holdingId: string): Promise<void> {
  const { data: lots, error } = await ctx.supabase
    .from("holding_lots")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("holding_id", holdingId)
    .order("occurred_on", { ascending: true });
  if (error) throw error;

  const derived = deriveFromLots((lots ?? []).map(rowToLot));

  const { error: updErr } = await ctx.supabase
    .from("holdings")
    .update({
      quantity: derived.quantity,
      avg_cost: derived.avgCost,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdingId)
    .eq("user_id", ctx.userId);
  if (updErr) throw updErr;
}

export const getHoldingLots = defineAction<
  z.infer<typeof lotListFilterSchema>,
  HoldingLot[],
  ActionContext
>({
  name: "getHoldingLots",
  input: lotListFilterSchema,
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from("holding_lots")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("holding_id", input.holdingId)
      .order("occurred_on", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToLot);
  },
});

export const addHoldingLot = defineAction<
  z.infer<typeof lotInputSchema>,
  HoldingLot,
  ActionContext
>({
  name: "addHoldingLot",
  input: lotInputSchema,
  tags: [lotsTags.all(), portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from("holding_lots")
      .insert({
        user_id: ctx.userId,
        holding_id: input.holdingId,
        type: input.type,
        occurred_on: input.occurredOn,
        quantity: input.quantity,
        price_unit: input.priceUnit,
        fees: input.fees,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await recomputeHolding(ctx, input.holdingId);
    bumpPaths();
    return rowToLot(data);
  },
});

export const deleteHoldingLot = defineAction<
  z.infer<typeof lotIdSchema>,
  { ok: true },
  ActionContext
>({
  name: "deleteHoldingLot",
  input: lotIdSchema,
  tags: [lotsTags.all(), portfolioTags.holdings()],
  handler: async ({ input, ctx }) => {
    // Need the holdingId to recompute — fetch lot first.
    const { data: lot, error: readErr } = await ctx.supabase
      .from("holding_lots")
      .select("holding_id")
      .eq("id", input.id)
      .eq("user_id", ctx.userId)
      .single();
    if (readErr) throw readErr;
    const holdingId = String(lot.holding_id);

    const { error } = await ctx.supabase
      .from("holding_lots")
      .delete()
      .eq("id", input.id)
      .eq("user_id", ctx.userId);
    if (error) throw error;

    await recomputeHolding(ctx, holdingId);
    bumpPaths();
    return { ok: true as const };
  },
});
