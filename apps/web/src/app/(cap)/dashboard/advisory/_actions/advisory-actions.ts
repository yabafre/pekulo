"use server";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-2 (verbatim from story 12-4-advisory-private-page:18):
//   Given a non-allowlisted or banned user (status: "none" or "banned"), When they navigate to /dashboard/advisory,
//   Then they cannot reach the surface (server-side gate triggers redirect("/dashboard"), no advisory data leaks to the client, and all underlying Server Actions reject with 403 FORBIDDEN).
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  advisorySessionSchema,
  advisoryStatusSchema,
  generateAnalysisInputSchema,
  type AdvisorySession,
  type AdvisoryStatus,
  type GenerateAnalysisInput,
} from "@pekulo/validators";
import { advisoryClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

export const getAdvisoryStatus = defineAction<void, AdvisoryStatus, ActionContext>({
  name: "getAdvisoryStatus",
  input: z.void(),
  output: advisoryStatusSchema,
  handler: async () => {
    await ensureRequestContext();
    return advisoryClient.status();
  },
});

export const getLatestAdvisorySession = defineAction<void, AdvisorySession | null, ActionContext>({
  name: "getLatestAdvisorySession",
  input: z.void(),
  output: advisorySessionSchema.nullable(),
  handler: async () => {
    await ensureRequestContext();
    return advisoryClient.getLatestSession();
  },
});

export const generateAdvisoryAnalysis = defineAction<
  GenerateAnalysisInput,
  AdvisorySession,
  ActionContext
>({
  name: "generateAdvisoryAnalysis",
  input: generateAnalysisInputSchema,
  output: advisorySessionSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    return advisoryClient.generateAnalysis(input);
  },
});
