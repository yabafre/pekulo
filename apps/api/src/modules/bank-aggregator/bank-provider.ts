// apps/api/src/modules/bank-aggregator/bank-provider.ts
// Provider abstraction per ADR-0015. Iso-pattern with `holdings/services/prices-client.ts`.
// BridgeProvider implements it under services/bridge-client.ts ; Powens (V2+)
// writes a sibling implementation in the same folder without touching the
// domain layer.

export interface ProviderConnectSession {
  connectUrl: string;
  sessionId: string;
}

export interface ProviderBankAccount {
  /** Volatile per-item Bridge account id — changes on every reconnect. Kept
   * for low-level mapping; NEVER use it as the local dedup key. */
  providerAccountId: string;
  /**
   * STABLE cross-reconnect identity (story 5-7 FIX 2026-05-28). Bridge mints a
   * fresh `providerAccountId` for every new item even when the user reconnects
   * the SAME real account, which duplicated local accounts. The IBAN is stable
   * across reconnects; cards carry no IBAN so we fall back to
   * `pid:{provider_id}:{name}`. This is the `providerAccountKey` the local
   * accounts table dedups on (unique (userId, provider, providerAccountKey)).
   */
  accountKey: string;
  bankName: string;
  accountName: string;
  kind: "checking" | "savings" | "other";
  currency: string;
  /** Current balance from Bridge (story 5-6 FIX 2026-05-27 — initially missed). */
  balance: number;
  /** Story 6-10 — the Bridge institution provider_id (for the bank-logo tier).
   * Present on every Bridge account row (IBAN or card); null if Bridge omits it. */
  providerId: string | null;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  /** Volatile per-item Bridge account id (raw `account_id` on the txn). */
  providerAccountId: string;
  /** STABLE account key (matches ProviderBankAccount.accountKey) — resolved by
   * the client from the item's accounts so refresh maps txns to the deduped
   * local account, not the volatile id (story 5-7 FIX 2026-05-28). */
  accountKey: string;
  occurredOn: Date;
  amount: number; // signed: positive for inflow, negative for outflow
  label: string;
  rawCategory: string | null;
  updatedAt: Date;
}

export interface ProviderItemState {
  providerItemId: string;
  // 0 = ok ; 1010 = SCA expired ; other codes per Bridge docs.
  statusCode: number;
  statusMessage: string;
  authenticationExpiresAt: Date | null;
}

export interface BankProvider {
  /**
   * Create a provider-side user (Bridge v3 requires this BEFORE any
   * user-scoped call). `externalUserId` is the Pekulo userId (Supabase auth
   * UUID); Bridge enforces it as unique per app, so callers MUST cache the
   * returned `providerUserUuid` (lazy-create-once pattern, persisted in the
   * `bridge_users` mapping table — story 5-6 FIX 2026-05-27).
   */
  createUser(args: { externalUserId: string }): Promise<{ providerUserUuid: string }>;

  /**
   * Build the Bridge-hosted Connect widget URL. Bridge v3 requires a 3-step
   * auth: app credentials (Client-Id/Secret) + user-level Bearer (minted
   * from `userUuid` via `/authorization/token`) + body `{user_email}` for
   * the SCA contact channel. The `userUuid` argument identifies the user
   * for token minting; the `userEmail` lands in the body. Implementation
   * mints the Bearer internally — callers don't manage user tokens.
   */
  createConnectSession(args: {
    userUuid: string;
    userEmail: string;
    redirectUri?: string;
    itemId?: string;
    forceReauthentication?: boolean;
  }): Promise<ProviderConnectSession>;

  /**
   * Bridge v3 stateful-widget model (story 5-6 FIX 2026-05-27, second smoke):
   * the Connect widget handles SCA + token exchange internally; the callback
   * redirect carries `item_id` directly (no OAuth code/state). All subsequent
   * item-scoped calls use a user-level Bearer (minted internally by the
   * client from `userUuid`) and the `item_id` in the URL path. No per-item
   * tokens are ever issued or persisted.
   */

  /**
   * List the bank accounts attached to a given item.
   */
  listAccounts(args: { userUuid: string; providerItemId: string }): Promise<ProviderBankAccount[]>;

  /**
   * Incremental transaction fetch — `since` drives Bridge's `?since=<ISO>` dedup
   * (Bridge returns rows with `updated_at > since` only).
   */
  listTransactions(args: {
    userUuid: string;
    providerItemId: string;
    since: Date | null;
  }): Promise<{ transactions: ProviderTransaction[]; latestUpdatedAt: Date | null }>;

  /**
   * Revoke a Bridge item — used by the 5-7 revoke flow. 5-6 implements but
   * does not expose via oRPC (the procedure ships in 5-7).
   */
  revokeItem(args: { userUuid: string; providerItemId: string }): Promise<void>;

  /**
   * Query the current item state — used by the cron-backup refresh to skip
   * items in `SCA_REQUIRED` (1010) without calling listTransactions.
   */
  getItem(args: { userUuid: string; providerItemId: string }): Promise<ProviderItemState>;

  /**
   * Story 6-10 (FR-65, tier 2) — the bank/institution logo for a Bridge
   * `provider_id`. App-level auth (Client-Id/Secret only, NO user Bearer):
   * Providers is the public bank directory (GET /v3/providers/:id). Returns
   * null on 404 / missing `images.logo` so the caller negative-caches and
   * falls through to the category icon. Shape validated against Providers/Get
   * a single provider in docs/ressources/Bridge API.postman_collection.json.
   */
  getProviderLogo(providerId: string): Promise<{ logoUrl: string | null }>;
}
