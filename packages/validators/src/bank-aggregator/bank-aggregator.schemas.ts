// packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts
// Zod schemas for the bank-aggregator domain (story 5-6 + ADR-0015).
// SOLE zod entry point per R1: `from "@pekulo/zod"` only.
//
// DTO discipline (NFR-31, AC-4): the public BankConnection NEVER carries
// accessTokenSecretId / refreshTokenSecretId. Those Vault FK columns live
// only on the repository row shape and are stripped at the service → DTO
// boundary. Enforced by AC-4 type-level guard + sentinel test (T28).

import { z } from "@pekulo/zod";

export const bankConnectionStatusSchema = z.enum(["active", "sca_required", "revoked"]);
export type BankConnectionStatus = z.infer<typeof bankConnectionStatusSchema>;

export const bankProviderSchema = z.enum(["bridge"]);
export type BankProviderName = z.infer<typeof bankProviderSchema>;

export const bankConnectionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().uuid(),
  provider: bankProviderSchema,
  providerItemId: z.string().min(1),
  status: bankConnectionStatusSchema,
  displayName: z.string().nullable(),
  // Incremental `since` cursor — advanced to the latest transaction watermark
  // only when the provider returns data (silent-data-loss defense). NOT the
  // user-facing "last synced" date; see `lastSyncedAt`.
  lastRefreshedAt: z.string().datetime().nullable(),
  // User-facing "Synchronisée le …" — stamped to now() on EVERY successful
  // poll, even an empty one. A healthy connection with no new transactions
  // must still show a fresh sync time (quick-spec 2026-06-10).
  lastSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type BankConnection = z.infer<typeof bankConnectionSchema>;

// ---------- initiateConnection ----------

export const initiateConnectionInputSchema = z.object({
  redirectUri: z.string().url().optional(),
});
export type InitiateConnectionInput = z.infer<typeof initiateConnectionInputSchema>;

export const initiateConnectionOutputSchema = z.object({
  connectUrl: z.string().url(),
  sessionId: z.string().min(1),
});
export type InitiateConnectionOutput = z.infer<typeof initiateConnectionOutputSchema>;

// ---------- completeConnection ----------
// Bridge v3 stateful-widget model (story 5-6 FIX 2026-05-27): the callback
// receives `item_id` + `user_uuid` (NOT OAuth code/state). The widget handles
// the OAuth + SCA dance server-side and just hands us the finalized item.

export const completeConnectionInputSchema = z.object({
  itemId: z.string().min(1),
  userUuid: z.string().min(1),
});
export type CompleteConnectionInput = z.infer<typeof completeConnectionInputSchema>;

export const completeConnectionOutputSchema = bankConnectionSchema;
export type CompleteConnectionOutput = z.infer<typeof completeConnectionOutputSchema>;

// ---------- listConnections ----------

export const listConnectionsOutputSchema = z.array(bankConnectionSchema);
export type ListConnectionsOutput = z.infer<typeof listConnectionsOutputSchema>;

// ---------- refreshConnection ----------

export const refreshConnectionInputSchema = z.object({
  connectionId: z.string().min(1),
});
export type RefreshConnectionInput = z.infer<typeof refreshConnectionInputSchema>;

export const refreshConnectionOutputSchema = z.object({
  fetched: z.number().int().nonnegative(),
  persisted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  // Story 5-6 post-review aped-review: nullable when Bridge returned 0 rows
  // on a non-first refresh — the service intentionally does NOT advance the
  // stamp so the next tick re-queries the same window (silent-data-loss
  // defense). Mirrors the BankConnection DTO's lastRefreshedAt shape.
  lastRefreshedAt: z.string().datetime().nullable(),
});
export type RefreshConnectionOutput = z.infer<typeof refreshConnectionOutputSchema>;

// ---------- renameConnection (story 5-7, FR-62) ----------

export const renameConnectionInputSchema = z.object({
  connectionId: z.string().min(1),
  displayName: z.string().trim().min(1).max(60),
});
export type RenameConnectionInput = z.infer<typeof renameConnectionInputSchema>;

export const renameConnectionOutputSchema = bankConnectionSchema;
export type RenameConnectionOutput = z.infer<typeof renameConnectionOutputSchema>;

// ---------- revokeConnection (story 5-7, FR-62) ----------

export const revokeConnectionInputSchema = z.object({
  connectionId: z.string().min(1),
});
export type RevokeConnectionInput = z.infer<typeof revokeConnectionInputSchema>;

export const revokeConnectionOutputSchema = z.object({
  ok: z.literal(true),
});
export type RevokeConnectionOutput = z.infer<typeof revokeConnectionOutputSchema>;

// ---------- reconnectConnection (story 5-7, FR-63 — SCA re-auth) ----------

export const reconnectConnectionInputSchema = z.object({
  connectionId: z.string().min(1),
});
export type ReconnectConnectionInput = z.infer<typeof reconnectConnectionInputSchema>;

export const reconnectConnectionOutputSchema = z.object({
  connectUrl: z.string().url(),
});
export type ReconnectConnectionOutput = z.infer<typeof reconnectConnectionOutputSchema>;
