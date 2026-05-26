"use server";

import { defineAction } from "@zapaction/core";
import {
  getMonthlyInputSchema,
  listMonthlyInputSchema,
  type GetMonthlyInput,
  type GetMonthlyOutput,
  type ListMonthlyInput,
  type ListMonthlyOutput,
} from "@pekulo/validators";
import { monthlyClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// L25 (2026-05-20): getMonthly + listMonthly both return discriminated
// `source` envelopes — omit `output:` so zapaction core doesn't reject the
// narrowed branches via output.parse. Generic types pin the contract.
//
// upsertMonthly is exposed by the api contract but has no V1 web surface
// (the /mensuel UI is read-only per ux-preview MonthlyScreen). Story 5-5
// sign-off will re-add it here when the freeze button needs a server action.

export const getMonthly = defineAction<GetMonthlyInput, GetMonthlyOutput, ActionContext>({
  name: "getMonthly",
  input: getMonthlyInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return monthlyClient.getMonthly(input);
  },
});

export const listMonthly = defineAction<ListMonthlyInput, ListMonthlyOutput, ActionContext>({
  name: "listMonthly",
  input: listMonthlyInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return monthlyClient.listMonthly(input);
  },
});
