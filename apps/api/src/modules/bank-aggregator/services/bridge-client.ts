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
  ProviderTokenPair,
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

  async function req<T>(path: string, init: RequestInit & { bearer?: string }): Promise<T> {
    const { bearer, headers: extra, ...rest } = init;
    const url = `${base}${path}`;
    const headers = { ...authHeaders(env, bearer), ...(extra ?? {}) };
    try {
      const res = await fetch(url, { ...rest, headers });
      if (!res.ok) {
        throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} → ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("bank provider unavailable")) throw err;
      const reason = err instanceof Error ? err.message : "unknown";
      throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} threw: ${reason}`);
    }
  }

  return {
    async createUser({ externalUserId }) {
      const data = await req<{ uuid: string; external_user_id: string }>(`/v3/aggregation/users`, {
        method: "POST",
        body: JSON.stringify({ external_user_id: externalUserId }),
      });
      return { providerUserUuid: data.uuid };
    },

    async createConnectSession({ userUuid, redirectUri, itemId, forceReauthentication }) {
      // Bridge v3 — connect-session takes user_uuid (provider-side UUID,
      // produced by createUser). Older docs / training data may show
      // user_email — that shape returns 401 in v3.
      const body: Record<string, unknown> = { user_uuid: userUuid };
      if (redirectUri) body.callback_url = redirectUri;
      if (itemId) body.item_id = itemId;
      if (forceReauthentication) body.force_reauthentication = true;
      const data = await req<{ id: string; url: string }>(`/v3/aggregation/connect-sessions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return { connectUrl: data.url, sessionId: data.id } satisfies ProviderConnectSession;
    },

    async exchangeCode({ code }) {
      // OAuth-equivalent code exchange — endpoint shape targets Bridge-Version 2025-01-15.
      const data = await req<{
        access_token: string;
        refresh_token: string;
        item_id: number;
        expires_at: string | null;
      }>(`/v3/aggregation/authorization/token`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      return {
        providerItemId: String(data.item_id),
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_at ? new Date(data.expires_at) : null,
        } satisfies ProviderTokenPair,
      };
    },

    async listAccounts({ tokens, providerItemId }) {
      const data = await req<{
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
        bearer: tokens.accessToken,
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

    async listTransactions({ tokens, providerItemId, since }) {
      const params = new URLSearchParams({ limit: "500" });
      if (since) params.set("since", since.toISOString());
      const data = await req<{
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
        bearer: tokens.accessToken,
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

    async revokeItem({ tokens, providerItemId }) {
      await req<{ ok: true }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "DELETE",
        bearer: tokens.accessToken,
      });
    },

    async getItem({ tokens, providerItemId }) {
      const data = await req<{
        id: number;
        status_code: number;
        status_code_info: string;
        authentication_expires_at: string | null;
      }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "GET",
        bearer: tokens.accessToken,
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
