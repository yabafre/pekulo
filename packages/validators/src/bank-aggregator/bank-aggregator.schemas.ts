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
  lastRefreshedAt: z.string().datetime().nullable(),
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

export const completeConnectionInputSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
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
  lastRefreshedAt: z.string().datetime(),
});
export type RefreshConnectionOutput = z.infer<typeof refreshConnectionOutputSchema>;
