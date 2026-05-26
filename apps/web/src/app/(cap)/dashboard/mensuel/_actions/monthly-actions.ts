"use server";

import { ORPCError } from "@orpc/client";
import { defineAction } from "@zapaction/core";
import {
  getMonthlyInputSchema,
  listMonthlyInputSchema,
  reopenMonthlyInputSchema,
  signOffMonthlyInputSchema,
  type GetMonthlyInput,
  type GetMonthlyOutput,
  type ListMonthlyInput,
  type ListMonthlyOutput,
  type MonthlyRecord,
  type ReopenMonthlyInput,
  type SignOffMonthlyInput,
} from "@pekulo/validators";
import { monthlyClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { monthlyTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// L25 (2026-05-20): getMonthly + listMonthly both return discriminated
// `source` envelopes — omit `output:` so zapaction core doesn't reject the
// narrowed branches via output.parse. Generic types pin the contract.
//
// 5-5: signOffMonthly + reopenMonthly also return discriminated envelopes
// ({ok:true}|{ok:false}) — `output:` is OMITTED for the same reason. The
// error codes mirror the API's PekuloError taxonomy; any unexpected
// ORPCError bubbles to the hook's onError.

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

export type SignOffMonthlyResult =
  | { ok: true; record: MonthlyRecord }
  | { ok: false; code: "MONTHLY_OUT_OF_WINDOW" | "MONTHLY_SIGNED_OFF"; message: string };

export type ReopenMonthlyResult =
  | { ok: true; record: MonthlyRecord }
  | { ok: false; code: "MONTHLY_NOT_FOUND"; message: string };

export const signOffMonthly = defineAction<
  SignOffMonthlyInput,
  SignOffMonthlyResult,
  ActionContext
>({
  name: "signOffMonthly",
  input: signOffMonthlyInputSchema,
  tags: [monthlyTags.all()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const record = await monthlyClient.signOffMonthly(input);
      return { ok: true as const, record };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "MONTHLY_OUT_OF_WINDOW" || err.code === "MONTHLY_SIGNED_OFF")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const reopenMonthly = defineAction<ReopenMonthlyInput, ReopenMonthlyResult, ActionContext>({
  name: "reopenMonthly",
  input: reopenMonthlyInputSchema,
  tags: [monthlyTags.all()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const record = await monthlyClient.reopenMonthly(input);
      return { ok: true as const, record };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "MONTHLY_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
