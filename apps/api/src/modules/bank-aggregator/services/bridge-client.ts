// apps/api/src/modules/bank-aggregator/services/bridge-client.ts
// BridgeProvider — outbound HTTP to api.bridgeapi.io per ADR-0015 + Bridge
// docs (verified via context7 /websites/bridgeapi_io on 2026-05-27).
//
// SECURITY discipline (NFR-31):
// - Client-Id + Client-Secret read from env (Dokploy only).
// - Access tokens NEVER logged.
// - Error envelopes carry method + url + status only — never body bytes.

import type { Env } from "../../../config/env";
import { bankProviderUnavailable } from "../bank-aggregator.errors";
import type {
  BankProvider,
  ProviderBankAccount,
  ProviderConnectSession,
  ProviderItemState,
  ProviderTransaction,
} from "../bank-provider";

function requireBridgeCreds(env: Env): { clientId: string; clientSecret: string } {
  if (!env.BRIDGE_CLIENT_ID || !env.BRIDGE_CLIENT_SECRET) {
    throw bankProviderUnavailable("BRIDGE_CLIENT_ID / BRIDGE_CLIENT_SECRET not configured");
  }
  return { clientId: env.BRIDGE_CLIENT_ID, clientSecret: env.BRIDGE_CLIENT_SECRET };
}

function authHeaders(env: Env, bearer?: string): Record<string, string> {
  const { clientId, clientSecret } = requireBridgeCreds(env);
  const h: Record<string, string> = {
    "Bridge-Version": env.BRIDGE_API_VERSION,
    "Client-Id": clientId,
    "Client-Secret": clientSecret,
    accept: "application/json",
    "content-type": "application/json",
  };
  if (bearer) h["Authorization"] = `Bearer ${bearer}`;
  return h;
}

export function createBridgeProvider(args: { env: Env }): BankProvider {
  const { env } = args;
  const base = env.BRIDGE_API_BASE.replace(/\/$/, "");

  async function req<T>(
    path: string,
    init: RequestInit & { bearer?: string; allowStatuses?: number[] },
  ): Promise<{ data: T; status: number }> {
    const { bearer, headers: extra, allowStatuses = [], ...rest } = init;
    const url = `${base}${path}`;
    const headers = { ...authHeaders(env, bearer), ...(extra ?? {}) };
    try {
      const res = await fetch(url, { ...rest, headers });
      if (!res.ok && !allowStatuses.includes(res.status)) {
        throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} → ${res.status}`);
      }
      const data = (await res.json()) as T;
      return { data, status: res.status };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("bank provider unavailable")) throw err;
      const reason = err instanceof Error ? err.message : "unknown";
      throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} threw: ${reason}`);
    }
  }

  // Convenience wrapper for callers that don't care about the status code
  // and want the JSON directly — the original `req` shape pre-FIX.
  async function reqJson<T>(path: string, init: RequestInit & { bearer?: string }): Promise<T> {
    return (await req<T>(path, init)).data;
  }

  // Bridge v3 user-level Bearer minting (cached briefly to amortize the extra
  // HTTP per item-scoped call). The token has ~2h TTL per the live sandbox
  // (`expires_at` ~2h ahead); we cache for 5 min to stay well below.
  // Per-user cache keyed by userUuid — same composition root, no cross-user
  // bleed.
  interface CachedToken {
    accessToken: string;
    cachedAt: number;
  }
  const userTokenCache = new Map<string, CachedToken>();
  const USER_TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

  async function mintUserAccessToken(userUuid: string): Promise<string> {
    const now = Date.now();
    const cached = userTokenCache.get(userUuid);
    if (cached && now - cached.cachedAt < USER_TOKEN_CACHE_TTL_MS) {
      return cached.accessToken;
    }
    const result = await reqJson<{ access_token: string; expires_at: string | null }>(
      `/v3/aggregation/authorization/token`,
      { method: "POST", body: JSON.stringify({ user_uuid: userUuid }) },
    );
    userTokenCache.set(userUuid, { accessToken: result.access_token, cachedAt: now });
    return result.access_token;
  }

  return {
    async createUser({ externalUserId }) {
      // Bridge enforces external_user_id unique per app. 409 = "user already
      // exists" — read back via list filter so the caller (the service's
      // resolveProviderUserUuid) can persist the mapping and continue.
      // Idempotency matters when persistence-after-create races (story 5-6
      // FIX 2026-05-27): the Bridge row exists but bridge_users locally may
      // not, so any future click would re-attempt and 409 indefinitely.
      const createResult = await req<{ uuid: string; external_user_id: string }>(
        `/v3/aggregation/users`,
        {
          method: "POST",
          body: JSON.stringify({ external_user_id: externalUserId }),
          allowStatuses: [409],
        },
      );
      if (createResult.status === 409) {
        const list = await reqJson<{
          resources: Array<{ uuid: string; external_user_id: string }>;
        }>(`/v3/aggregation/users?external_user_id=${encodeURIComponent(externalUserId)}`, {
          method: "GET",
        });
        const found = list.resources.find((u) => u.external_user_id === externalUserId);
        if (!found) {
          throw bankProviderUnavailable(
            `bridge POST /v3/aggregation/users → 409 but list filter returned 0 matches for external_user_id=${externalUserId}`,
          );
        }
        return { providerUserUuid: found.uuid };
      }
      return { providerUserUuid: createResult.data.uuid };
    },

    async createConnectSession({
      userUuid,
      userEmail,
      redirectUri,
      itemId,
      forceReauthentication,
    }) {
      // Bridge v3 — 3-tier auth on user-scoped endpoints (smoke-test 2026-05-27):
      //   1. App auth (Client-Id/Secret in headers — set by authHeaders)
      //   2. User-level Bearer (minted via mintUserAccessToken)
      //   3. POST /connect-sessions with Bearer + body { user_email, ... }
      // The user_uuid MUST NOT appear in the body (the Bearer identifies the
      // user); body describes the session only.
      const bearer = await mintUserAccessToken(userUuid);
      const body: Record<string, unknown> = { user_email: userEmail };
      if (redirectUri) body.callback_url = redirectUri;
      if (itemId) body.item_id = itemId;
      if (forceReauthentication) body.force_reauthentication = true;
      const data = await reqJson<{ id: string; url: string }>(`/v3/aggregation/connect-sessions`, {
        method: "POST",
        body: JSON.stringify(body),
        bearer,
      });
      return { connectUrl: data.url, sessionId: data.id } satisfies ProviderConnectSession;
    },

    async listAccounts({ userUuid, providerItemId }) {
      const bearer = await mintUserAccessToken(userUuid);
      const data = await reqJson<{
        resources: Array<{
          id: number;
          name: string;
          bank_id: number;
          bank_name: string;
          type: string;
          currency_code: string;
        }>;
      }>(`/v3/aggregation/items/${providerItemId}/accounts`, {
        method: "GET",
        bearer,
      });
      return data.resources.map(
        (r) =>
          ({
            providerAccountId: String(r.id),
            bankName: r.bank_name,
            accountName: r.name,
            kind: r.type === "savings" ? "savings" : r.type === "checking" ? "checking" : "other",
            currency: r.currency_code,
          }) satisfies ProviderBankAccount,
      );
    },

    async listTransactions({ userUuid, providerItemId, since }) {
      const bearer = await mintUserAccessToken(userUuid);
      const params = new URLSearchParams({ limit: "500" });
      if (since) params.set("since", since.toISOString());
      const data = await reqJson<{
        resources: Array<{
          id: number;
          account_id: number;
          amount: number;
          description: string;
          category_id: number | null;
          date: string;
          updated_at: string;
        }>;
      }>(`/v3/aggregation/items/${providerItemId}/transactions?${params.toString()}`, {
        method: "GET",
        bearer,
      });
      let latest: Date | null = null;
      const transactions = data.resources.map((r) => {
        const updatedAt = new Date(r.updated_at);
        if (!latest || updatedAt > latest) latest = updatedAt;
        return {
          providerTransactionId: String(r.id),
          providerAccountId: String(r.account_id),
          occurredOn: new Date(r.date),
          amount: r.amount,
          label: r.description,
          rawCategory: r.category_id !== null ? String(r.category_id) : null,
          updatedAt,
        } satisfies ProviderTransaction;
      });
      return { transactions, latestUpdatedAt: latest };
    },

    async revokeItem({ userUuid, providerItemId }) {
      const bearer = await mintUserAccessToken(userUuid);
      await reqJson<{ ok: true }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "DELETE",
        bearer,
      });
    },

    async getItem({ userUuid, providerItemId }) {
      const bearer = await mintUserAccessToken(userUuid);
      const data = await reqJson<{
        id: number;
        status_code: number;
        status_code_info: string;
        authentication_expires_at: string | null;
      }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "GET",
        bearer,
      });
      return {
        providerItemId: String(data.id),
        statusCode: data.status_code,
        statusMessage: data.status_code_info,
        authenticationExpiresAt: data.authentication_expires_at
          ? new Date(data.authentication_expires_at)
          : null,
      } satisfies ProviderItemState;
    },
  };
}
