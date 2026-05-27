// apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts
// oRPC router binding bankAggregatorContract to the service (story 5-6).
//
// AC-9 — refreshConnection carries a per-user rate limit (10 calls / 60s).
// Beyond the budget we surface BANK_PROVIDER_UNAVAILABLE so the wire shape
// stays inside the declared error union (the contract intentionally omits a
// dedicated RATE_LIMITED code for this route — the practical cause is
// "too many refresh probes, try again in a minute" which maps cleanly to the
// upstream-pressure semantics of BANK_PROVIDER_UNAVAILABLE).
//
// Identity propagation: $context<{ userId, email }> mirrors the rest of the
// modules. requireUserId / requireEmail guard the entry points.

import { implement } from "@orpc/server";
import { bankAggregatorContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import { BankAggregatorError } from "./bank-aggregator.errors";
import type { BankAggregatorService } from "./bank-aggregator.service";

const impl = implement(bankAggregatorContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

function requireEmail(email: string | null | undefined): asserts email is string {
  if (!email) {
    throw new PekuloError("UNAUTHORIZED", "user email missing — bank-aggregator requires it");
  }
}

// Per-user refresh rate limit. Cleared on natural window expiry. Process-local
// (not Redis-backed) — V1 single-instance Dokploy deploy; revisit when scaling
// out to multi-replica (NFR-15: ≤ 100 concurrent users keeps this cheap).
const REFRESH_WINDOW_MS = 60_000;
const REFRESH_MAX_PER_WINDOW = 10;
const refreshRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRefreshRate(userId: string): boolean {
  const now = Date.now();
  const slot = refreshRateLimit.get(userId);
  if (!slot || slot.resetAt < now) {
    refreshRateLimit.set(userId, { count: 1, resetAt: now + REFRESH_WINDOW_MS });
    return true;
  }
  if (slot.count >= REFRESH_MAX_PER_WINDOW) return false;
  slot.count++;
  return true;
}

export function createBankAggregatorRouter(deps: { service: BankAggregatorService }) {
  return impl.router({
    initiateConnection: impl.initiateConnection.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      requireEmail(context.email);
      try {
        return await deps.service.initiateConnection(context.userId, context.email, input);
      } catch (err) {
        if (err instanceof BankAggregatorError && err.code === "BANK_PROVIDER_UNAVAILABLE") {
          throw errors.BANK_PROVIDER_UNAVAILABLE({ message: err.message });
        }
        throw err;
      }
    }),

    completeConnection: impl.completeConnection.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      requireEmail(context.email);
      try {
        return await deps.service.completeConnection(context.userId, context.email, input);
      } catch (err) {
        if (err instanceof BankAggregatorError) {
          if (err.code === "BANK_CONNECTION_ALREADY_EXISTS") {
            throw errors.BANK_CONNECTION_ALREADY_EXISTS({ message: err.message });
          }
          if (err.code === "BANK_PROVIDER_UNAVAILABLE") {
            throw errors.BANK_PROVIDER_UNAVAILABLE({ message: err.message });
          }
        }
        throw err;
      }
    }),

    listConnections: impl.listConnections.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.listConnections(context.userId);
    }),

    refreshConnection: impl.refreshConnection.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      if (!checkRefreshRate(context.userId)) {
        throw errors.BANK_PROVIDER_UNAVAILABLE({
          message: "rate limit exceeded — retry in 60s",
        });
      }
      try {
        return await deps.service.refreshConnection(context.userId, input);
      } catch (err) {
        if (err instanceof BankAggregatorError) {
          if (err.code === "BANK_CONNECTION_NOT_FOUND") {
            throw errors.BANK_CONNECTION_NOT_FOUND({ message: err.message });
          }
          if (err.code === "BANK_SCA_REQUIRED") {
            throw errors.BANK_SCA_REQUIRED({ message: err.message });
          }
          if (err.code === "BANK_PROVIDER_UNAVAILABLE") {
            throw errors.BANK_PROVIDER_UNAVAILABLE({ message: err.message });
          }
        }
        throw err;
      }
    }),
  });
}
