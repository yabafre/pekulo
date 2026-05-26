"use server";

import { defineAction } from "@zapaction/core";
import {
  getMonthlyInputSchema,
  upsertMonthlyInputSchema,
  type GetMonthlyInput,
  type GetMonthlyOutput,
  type MonthlyRecord,
  type UpsertMonthlyInput,
} from "@pekulo/validators";
import { monthlyClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { monthlyTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// L25 (2026-05-20): getMonthly returns a discriminated `source` envelope —
// omit `output:` to avoid the zapaction-core `output.parse(result)` reject
// path against a narrowed schema. The generic types still pin the contract
// for callers. upsertMonthly returns a single MonthlyRecord and could carry
// `output:`, but the prefixed-id regex inside monthlyRecordSchema would
// reject the server-issued id on the client; the round-trip stays typed
// via the generic.

export const getMonthly = defineAction<GetMonthlyInput, GetMonthlyOutput, ActionContext>({
  name: "getMonthly",
  input: getMonthlyInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return monthlyClient.getMonthly(input);
  },
});

export const upsertMonthly = defineAction<UpsertMonthlyInput, MonthlyRecord, ActionContext>({
  name: "upsertMonthly",
  input: upsertMonthlyInputSchema,
  tags: [monthlyTags.get(0, 0)],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return monthlyClient.upsertMonthly(input);
  },
});
