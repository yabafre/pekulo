// apps/api/src/modules/bank-aggregator/bank-provider.ts
// Provider abstraction per ADR-0015. Iso-pattern with `holdings/services/prices-client.ts`.
// BridgeProvider implements it under services/bridge-client.ts ; Powens (V2+)
// writes a sibling implementation in the same folder without touching the
// domain layer.

export interface ProviderConnectSession {
  connectUrl: string;
  sessionId: string;
}

export interface ProviderTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
}

export interface ProviderBankAccount {
  providerAccountId: string;
  bankName: string;
  accountName: string;
  kind: "checking" | "savings" | "other";
  currency: string;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  providerAccountId: string;
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
   * Exchange the `code` from the OAuth callback for an access + refresh token
   * pair plus the resolved `providerItemId`.
   */
  exchangeCode(args: {
    code: string;
    state: string;
  }): Promise<{ providerItemId: string; tokens: ProviderTokenPair }>;

  /**
   * List the bank accounts attached to a given item.
   */
  listAccounts(args: {
    tokens: ProviderTokenPair;
    providerItemId: string;
  }): Promise<ProviderBankAccount[]>;

  /**
   * Incremental transaction fetch — `since` drives Bridge's `?since=<ISO>` dedup
   * (Bridge returns rows with `updated_at > since` only).
   */
  listTransactions(args: {
    tokens: ProviderTokenPair;
    providerItemId: string;
    since: Date | null;
  }): Promise<{ transactions: ProviderTransaction[]; latestUpdatedAt: Date | null }>;

  /**
   * Revoke a Bridge item — used by the 5-7 revoke flow. 5-6 implements but
   * does not expose via oRPC (the procedure ships in 5-7).
   */
  revokeItem(args: { tokens: ProviderTokenPair; providerItemId: string }): Promise<void>;

  /**
   * Query the current item state — used by the cron-backup refresh to skip
   * items in `SCA_REQUIRED` (1010) without calling listTransactions.
   */
  getItem(args: { tokens: ProviderTokenPair; providerItemId: string }): Promise<ProviderItemState>;
}
