// apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts
// Bank-aggregator domain service (story 5-6 + ADR-0015).
//
// THIS FILE: interface declaration. Implementation (createBankAggregatorService
// factory) lands in T15-T17 once the repository + BridgeProvider are in place.
// Carrying the interface here unblocks T12 (the webhook router imports the
// type without depending on the impl).

import type { BankConnection } from "@pekulo/validators";

export interface BankAggregatorService {
  initiateConnection(
    userId: string,
    input: { redirectUri?: string },
    ctx: { userEmail: string },
  ): Promise<{ connectUrl: string; sessionId: string }>;

  completeConnection(
    userId: string,
    input: { code: string; state: string },
    ctx: { userEmail: string },
  ): Promise<BankConnection>;

  listConnections(userId: string): Promise<BankConnection[]>;

  refreshConnection(
    userId: string,
    input: { connectionId: string },
  ): Promise<{
    fetched: number;
    persisted: number;
    skipped: number;
    lastRefreshedAt: string;
  }>;

  /**
   * Iterate active connections across all users — invoked by the Bun cron
   * scheduler. Skips sca_required + revoked. Per-user iteration serialises
   * the per-connection refresh to avoid hammering Bridge with parallel calls.
   */
  refreshAll(): Promise<void>;

  /**
   * Dispatch an inbound webhook event. The router has already verified the
   * HMAC + body cap — by the time we land here the payload is trusted.
   */
  handleWebhookEvent(event: unknown): Promise<void>;

  /**
   * Return the Bridge reconnect URL for a connection in sca_required —
   * consumed by 5-7's "Reconnecter" CTA. Implementation lands in T16.
   */
  getReconnectUrl(userId: string, connectionId: string): Promise<string>;
}
