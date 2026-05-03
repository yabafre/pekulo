"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { monthlyEntrySchema, monthlyKeySchema, formatMonthLabel } from "@/lib/schemas/monthly";
import { monthlyTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";
import type { MonthlyEntry } from "@/lib/types";

const rowToEntry = (row: Record<string, unknown>): MonthlyEntry => ({
  year: Number(row.year),
  monthNum: Number(row.month_num),
  monthLabel: String(row.month_label ?? ""),
  net: Number(row.net),
  avantages: Number(row.avantages),
  depenses: Number(row.depenses),
  credit: Number(row.credit),
  remote: Number(row.remote),
  freelance: Number(row.freelance),
  epargneMois: Number(row.epargne_mois),
});

export const getMonthlyEntries = defineAction<void, MonthlyEntry[], ActionContext>({
  name: "getMonthlyEntries",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("monthly_tracking")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("year", { ascending: true })
      .order("month_num", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToEntry);
  },
});

export const saveMonthlyEntry = defineAction<
  z.infer<typeof monthlyEntrySchema>,
  MonthlyEntry,
  ActionContext
>({
  name: "saveMonthlyEntry",
  input: monthlyEntrySchema,
  tags: [monthlyTags.list()],
  handler: async ({ input, ctx }) => {
    const epargneMois = input.net + input.remote + input.freelance - input.depenses - input.credit;
    const { data, error } = await ctx.supabase
      .from("monthly_tracking")
      .upsert(
        {
          user_id: ctx.userId,
          year: input.year,
          month_num: input.monthNum,
          month_label: formatMonthLabel(input.year, input.monthNum),
          net: input.net,
          avantages: input.avantages,
          depenses: input.depenses,
          credit: input.credit,
          remote: input.remote,
          freelance: input.freelance,
          epargne_mois: epargneMois,
          perf_marche: 0,
          epargne_cumul: 0,
          capital_total: 0,
        },
        { onConflict: "user_id,month_num,year" },
      )
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/mensuel");
    revalidatePath("/dashboard");
    return rowToEntry(data);
  },
});

export const deleteMonthlyEntry = defineAction<
  z.infer<typeof monthlyKeySchema>,
  { ok: true },
  ActionContext
>({
  name: "deleteMonthlyEntry",
  input: monthlyKeySchema,
  tags: [monthlyTags.list()],
  handler: async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from("monthly_tracking")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("year", input.year)
      .eq("month_num", input.monthNum);
    if (error) throw error;
    revalidatePath("/dashboard/mensuel");
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});
