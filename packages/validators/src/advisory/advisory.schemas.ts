// Zod source of truth for the private advisory access gate (story 12-1,
// ADR-0016 §4). Consumed by @pekulo/contracts (oRPC I/O), the apps/api
// service, and (from 12-4) the web tier.
import { z } from "@pekulo/zod";

// Postgres enum advisory_access_status is bound 1:1; "none" is the wire-only
// state for a caller with no row (only reachable by an owner, because the
// gate rejects everyone else before the handler runs).
export const ADVISORY_ACCESS_STATES = ["active", "banned", "none"] as const;
export const advisoryAccessStateSchema = z.enum(ADVISORY_ACCESS_STATES);
export type AdvisoryAccessState = z.infer<typeof advisoryAccessStateSchema>;

// Persisted states only — the repository never returns "none".
export const advisoryAccessStatusSchema = z.enum(["active", "banned"]);
export type AdvisoryAccessStatus = z.infer<typeof advisoryAccessStatusSchema>;

export const advisoryTargetInputSchema = z.object({
  userId: z.string().uuid(),
});
export type AdvisoryTargetInput = z.infer<typeof advisoryTargetInputSchema>;

// Timestamps are ISO strings on the wire (the repository maps Date →
// toISOString), matching the llmCallLogEntrySchema convention.
export const advisoryAccessEntrySchema = z.object({
  userId: z.string().uuid(),
  status: advisoryAccessStatusSchema,
  grantedBy: z.string().uuid().nullable(),
  grantedAt: z.string().nullable(),
  bannedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type AdvisoryAccessEntry = z.infer<typeof advisoryAccessEntrySchema>;

export const advisoryStatusSchema = z.object({
  access: advisoryAccessStateSchema,
  owner: z.boolean(),
});
export type AdvisoryStatus = z.infer<typeof advisoryStatusSchema>;

export const advisoryAccessListSchema = z.array(advisoryAccessEntrySchema);
export type AdvisoryAccessList = z.infer<typeof advisoryAccessListSchema>;
