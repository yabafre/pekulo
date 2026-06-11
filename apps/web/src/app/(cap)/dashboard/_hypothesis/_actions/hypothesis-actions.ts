"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  recordProjectionSchema,
  getProjectionInputSchema,
  type RecordProjectionInput,
  type HypothesisProjectionDto,
} from "@pekulo/validators";
import { hypothesisClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 7-3 — thin oRPC delegators (ADR-0010, mirror 7-1 dashboard-actions).
// The write returns a { ok } envelope so the typed error code survives Next's
// prod Error sanitisation; `output:` is OMITTED (lesson 2026-05-20 [BLOCKER] —
// a success-only output schema would reject the { ok: false } branch).
type RecordResult =
  | { ok: true; projection: RecordProjectionInput }
  | { ok: false; code: string; message: string };

export const recordHypothesisProjection = defineAction<
  RecordProjectionInput,
  RecordResult,
  ActionContext
>({
  name: "recordHypothesisProjection",
  input: recordProjectionSchema,
  tags: [], // server-side revalidateTag is not used; client invalidates via the hook
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const projection = await hypothesisClient.recordProjection(input);
      return { ok: true, projection };
    } catch (err) {
      const code = (err as { code?: string }).code ?? "INTERNAL";
      const message = err instanceof Error ? err.message : "record failed";
      return { ok: false, code, message };
    }
  },
});

// Read-only (mirror getDashboardOverview): no envelope, direct return.
export const getHypothesisProjection = defineAction<
  z.infer<typeof getProjectionInputSchema>,
  HypothesisProjectionDto,
  ActionContext
>({
  name: "getHypothesisProjection",
  input: getProjectionInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return hypothesisClient.getProjection(input);
  },
});
