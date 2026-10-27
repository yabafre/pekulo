// packages/validators/src/advisory/advisory.llm.schemas.ts
// Zod schemas and TypeScript types for advisory LLM outputs and sessions (story 12-3, AC-1, AC-5).

import { z } from "@pekulo/zod";
import { advisorySnapshotSchema } from "./advisory.snapshot.schemas";

export const ADVISORY_RECOMMENDATION_ACTIONS = [
  "buy",
  "sell",
  "hold",
  "trim",
  "rebalance",
  "allocate",
  "reduce",
] as const;
export const advisoryRecommendationActionSchema = z.enum(ADVISORY_RECOMMENDATION_ACTIONS);
export type AdvisoryRecommendationAction = z.infer<typeof advisoryRecommendationActionSchema>;

export const ADVISORY_RECOMMENDATION_PRIORITIES = ["high", "medium", "low"] as const;
export const advisoryRecommendationPrioritySchema = z.enum(ADVISORY_RECOMMENDATION_PRIORITIES);
export type AdvisoryRecommendationPriority = z.infer<typeof advisoryRecommendationPrioritySchema>;

export const advisoryInstrumentRecommendationSchema = z.object({
  symbol: z.string().min(1),
  isin: z.string().optional(),
  action: z.enum(["buy", "sell", "hold", "trim"]),
  rationale: z.string().min(1),
});
export type AdvisoryInstrumentRecommendation = z.infer<
  typeof advisoryInstrumentRecommendationSchema
>;

export const advisoryRecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  action: advisoryRecommendationActionSchema,
  target: z.string().min(1),
  rationale: z.string().min(1),
  priority: advisoryRecommendationPrioritySchema,
  instrumentRecommendation: advisoryInstrumentRecommendationSchema.optional(),
});
export type AdvisoryRecommendation = z.infer<typeof advisoryRecommendationSchema>;

export const advisoryAnalysisResultSchema = z.object({
  overview: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  allocationAdvice: z.string().min(1),
  recommendations: z.array(advisoryRecommendationSchema),
});
export type AdvisoryAnalysisResult = z.infer<typeof advisoryAnalysisResultSchema>;

export const advisorySessionDataSchema = z.object({
  snapshot: advisorySnapshotSchema,
  analysis: advisoryAnalysisResultSchema,
  generatedAt: z.string().datetime(),
});
export type AdvisorySessionData = z.infer<typeof advisorySessionDataSchema>;

export const advisorySessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().uuid(),
  snapshotVersion: z.number().int().positive(),
  model: z.string().min(1),
  provider: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sessionData: advisorySessionDataSchema,
});
export type AdvisorySession = z.infer<typeof advisorySessionSchema>;

export const advisorySessionSummarySchema = z.object({
  id: z.string().min(1),
  userId: z.string().uuid(),
  snapshotVersion: z.number().int().positive(),
  model: z.string().min(1),
  provider: z.string().min(1),
  createdAt: z.string().datetime(),
  overview: z.string().min(1),
  recommendationsCount: z.number().int().nonnegative(),
});
export type AdvisorySessionSummary = z.infer<typeof advisorySessionSummarySchema>;

export const advisorySessionListSchema = z.object({
  sessions: z.array(advisorySessionSummarySchema),
  totalCount: z.number().int().nonnegative(),
});
export type AdvisorySessionList = z.infer<typeof advisorySessionListSchema>;

export const generateAnalysisInputSchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
});
export type GenerateAnalysisInput = z.infer<typeof generateAnalysisInputSchema>;
