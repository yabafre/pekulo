"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  compassSchema,
  listHistoryInputSchema,
  updateCompassInputSchema,
  type Compass,
  type CompassProgress,
  type UpdateCompassInput,
} from "@pekulo/validators";
import type { CompassCurve, CompassHistoryEntry, CompassSetupState } from "@pekulo/types";
import { compassClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { compassTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 1-4 — thin oRPC delegators. The web tier owns ZERO business logic;
// every read/write goes through compassClient (per ADR-0010 hard layering).
// No cross-feature import (pekulo/no-cross-feature-action-import) — this
// file MUST NOT import from milestones-actions.ts.
//
// Each handler calls `ensureRequestContext()` defensively before the oRPC
// call. Lesson L25 — AsyncLocalStorage `enterWith` from zapaction's
// `setActionContext` resolver does not always propagate into the handler's
// async chain on Next.js 16.x (re-verify on every Next minor bump). The
// handler-side ensure is idempotent: if the resolver already seeded the
// store, we short-circuit on the existing entry.

export const getCompass = defineAction<void, Compass | null, ActionContext>({
  name: "getCompass",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return compassClient.getCompass();
  },
});

export const getSetupState = defineAction<void, CompassSetupState, ActionContext>({
  name: "getSetupState",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    const { state } = await compassClient.getSetupState();
    return state;
  },
});

export const getCurrentProgress = defineAction<void, CompassProgress, ActionContext>({
  name: "getCurrentProgress",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return compassClient.getCurrentProgress();
  },
});

export const getCompassCurve = defineAction<void, CompassCurve, ActionContext>({
  name: "getCompassCurve",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return compassClient.getCompassCurve();
  },
});

export const listHistory = defineAction<
  z.infer<typeof listHistoryInputSchema>,
  CompassHistoryEntry[],
  ActionContext
>({
  name: "listHistory",
  input: listHistoryInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return compassClient.listHistory(input);
  },
});

export const updateCompass = defineAction<UpdateCompassInput, Compass, ActionContext>({
  name: "updateCompass",
  input: updateCompassInputSchema,
  output: compassSchema,
  tags: [compassTags.current()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return compassClient.updateCompass(input);
  },
});
