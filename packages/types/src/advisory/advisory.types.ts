// packages/types/src/advisory/advisory.types.ts
// Advisory surface types (story 12-2, 12-3). The Zod-inferred shapes in
// @pekulo/validators are the runtime SSOT; this module re-exports them so
// apps/api and apps/web can import the domain shapes from @pekulo/types.
export type {
  AdvisoryAllocationKey,
  AdvisorySnapshot,
  AdvisorySnapshotAllocationLine,
  AdvisorySnapshotByKind,
  AdvisorySnapshotCompass,
  AdvisorySnapshotFiscalEnvelope,
  AdvisorySnapshotFiscalProperty,
  AdvisorySnapshotFiscalite,
  AdvisorySnapshotFx,
  AdvisorySnapshotMonthlyCashflow,
  AdvisorySnapshotPortfolio,
  AdvisorySnapshotPosition,
  AdvisorySnapshotWealth,
  AdvisoryRecommendationAction,
  AdvisoryRecommendationPriority,
  AdvisoryInstrumentRecommendation,
  AdvisoryRecommendation,
  AdvisoryAnalysisResult,
  AdvisorySessionData,
  AdvisorySession,
  AdvisorySessionSummary,
  AdvisorySessionList,
  GenerateAnalysisInput,
} from "@pekulo/validators";
