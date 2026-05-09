"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import { compassTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 1-4 — thin oRPC delegators. The web tier owns ZERO business logic;
// every read/write goes through compassClient (per ADR-0010 hard layering).
// No cross-feature import (pekulo/no-cross-feature-action-import) — this
// file MUST NOT import from milestones-actions.ts.

export const getCompass = defineAction<void, Compass | null, ActionContext>({
  name: "getCompass",
  input: z.void(),
  handler: async () => compassClient.getCompass(),
});

export const getSetupState = defineAction<void, CompassSetupState, ActionContext>({
  name: "getSetupState",
  input: z.void(),
  handler: async () => {
    const { state } = await compassClient.getSetupState();
    return state;
  },
});

export const getCurrentProgress = defineAction<void, CompassProgress, ActionContext>({
  name: "getCurrentProgress",
  input: z.void(),
  handler: async () => compassClient.getCurrentProgress(),
});

export const getCompassCurve = defineAction<void, CompassCurve, ActionContext>({
  name: "getCompassCurve",
  input: z.void(),
  handler: async () => compassClient.getCompassCurve(),
});

export const listHistory = defineAction<
  z.infer<typeof listHistoryInputSchema>,
  CompassHistoryEntry[],
  ActionContext
>({
  name: "listHistory",
  input: listHistoryInputSchema,
  handler: async ({ input }) => compassClient.listHistory(input),
});

export const updateCompass = defineAction<UpdateCompassInput, Compass, ActionContext>({
  name: "updateCompass",
  input: updateCompassInputSchema,
  output: compassSchema,
  tags: [compassTags.current()],
  handler: async ({ input }) => {
    const persisted = await compassClient.updateCompass(input);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/parametres");
    return persisted;
  },
});
