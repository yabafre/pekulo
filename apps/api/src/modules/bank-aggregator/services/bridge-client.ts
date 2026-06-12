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

// Story 5-6 FIX (post-review aped-review): every Bridge HTTP call carries an
// AbortSignal so a hung upstream does not block the cron loop indefinitely.
// 10s budget covers the slowest happy-path seen on the sandbox; any longer is
// a Bridge outage by V1's NFR-18 budget (provider fallback within 500ms after
// 10s upstream timeout is the safe shape — we surface bankProviderUnavailable).
const BRIDGE_FETCH_TIMEOUT_MS = 10_000;

export function createBridgeProvider(args: { env: Env }): BankProvider {
  const { env } = args;
  const base = env.BRIDGE_API_BASE.replace(/\/$/, "");

  async function req<T>(
    path: string,
    init: RequestInit & { bearer?: string; allowStatuses?: number[]; timeoutMs?: number },
  ): Promise<{ data: T; status: number }> {
    const { bearer, headers: extra, allowStatuses = [], timeoutMs, ...rest } = init;
    const url = `${base}${path}`;
    const headers = { ...authHeaders(env, bearer), ...(extra ?? {}) };
    const signal = AbortSignal.timeout(timeoutMs ?? BRIDGE_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...rest, headers, signal });
      if (!res.ok && !allowStatuses.includes(res.status)) {
        throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} → ${res.status}`);
      }
      // Parse defensively: an ALLOWED non-2xx (e.g. a 404 admitted via
      // allowStatuses) may carry an empty or non-JSON body — return undefined
      // data + the status so the caller branches on the status code instead of
      // throwing. A 2xx with unparseable JSON is still a hard provider error.
      const text = await res.text();
      let data: T;
      if (!text) {
        data = undefined as T;
      } else {
        try {
          data = JSON.parse(text) as T;
        } catch (parseErr) {
          if (res.ok) throw parseErr;
          data = undefined as T;
        }
      }
      return { data, status: res.status };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("bank provider unavailable")) throw err;
      // AbortError ⇒ explicit timeout. Surface as bankProviderUnavailable per
      // the contract so callers stay inside the typed-error envelope.
      if (err instanceof Error && err.name === "TimeoutError") {
        throw bankProviderUnavailable(
          `bridge ${rest.method ?? "GET"} ${path} timed out after ${timeoutMs ?? BRIDGE_FETCH_TIMEOUT_MS}ms`,
        );
      }
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

  interface BridgeAccountRow {
    id: number;
    name: string;
    iban?: string | null;
    provider_id?: number | null;
    balance: number | null;
    type: string;
    currency_code: string;
  }

  // STABLE cross-reconnect account identity (story 5-7 FIX 2026-05-28). Bridge
  // mints a fresh `id` for the same real account on every new item, so the raw
  // id duplicates local accounts on reconnect. The IBAN is stable; cards carry
  // no IBAN, so fall back to provider_id (institution) + name (which holds the
  // masked card number) — also stable across reconnects.
  function bridgeAccountKey(a: {
    iban?: string | null;
    provider_id?: number | null;
    name: string;
  }): string {
    const iban = a.iban?.trim();
    if (iban) return `iban:${iban}`;
    return `pid:${a.provider_id ?? "unknown"}:${a.name}`;
  }

  // Fetch the accounts attached to one item. Unlike /transactions, the
  // /accounts endpoint DOES honor `item_id` (confirmed live 2026-05-28), so
  // this is the authoritative item→accounts mapping that both listAccounts and
  // listTransactions build on.
  async function fetchItemAccounts(
    userUuid: string,
    providerItemId: string,
  ): Promise<BridgeAccountRow[]> {
    const bearer = await mintUserAccessToken(userUuid);
    const data = await reqJson<{ resources: BridgeAccountRow[] }>(
      `/v3/aggregation/accounts?item_id=${encodeURIComponent(providerItemId)}`,
      { method: "GET", bearer },
    );
    return data.resources;
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
      // Bridge v3 — flat REST: GET /v3/aggregation/accounts?item_id=<id>.
      // Schema verified against docs/ressources/Bridge API.postman_collection.json:
      // accounts carry { id, name, iban, provider_id, balance, type,
      // currency_code, item_id, ... }. `accountKey` is the stable dedup
      // identity (IBAN / provider_id+name) — see bridgeAccountKey.
      const rows = await fetchItemAccounts(userUuid, providerItemId);
      return rows.map(
        (r) =>
          ({
            providerAccountId: String(r.id),
            accountKey: bridgeAccountKey(r),
            bankName: "Banque",
            accountName: r.name,
            kind: r.type === "savings" ? "savings" : r.type === "checking" ? "checking" : "other",
            currency: r.currency_code,
            balance: typeof r.balance === "number" ? r.balance : 0,
            providerId: r.provider_id != null ? String(r.provider_id) : null,
          }) satisfies ProviderBankAccount,
      );
    },

    async listTransactions({ userUuid, providerItemId, since, until }) {
      // Bridge v3 — GET /v3/aggregation/transactions does NOT honor `item_id`
      // (confirmed live 2026-05-28: a bogus item_id still returns the user's
      // FULL set across every item). The documented + working filter is
      // `account_id`. So we resolve THIS item's account ids (/accounts honors
      // item_id) and keep only transactions belonging to them — otherwise a
      // user with ≥2 connected banks would see item A's refresh pull item B's
      // transactions. We also follow the `next_uri` cursor so items with >500
      // transactions are fully fetched (the old limit=500 cap silently
      // truncated older rows).
      //
      // Ordering (context7 /websites/bridgeapi_io 2026-06-12): the list is
      // REVERSE-chronological by `updated_at`, so page 1 is the NEWEST rows and
      // the cursor walks DOWNWARD in time. `since` bounds the window below
      // (`updated_at > since`); `until` bounds it above (`updated_at < until`)
      // and lets the caller drain a history longer than MAX_PAGES one slice
      // per tick (see the `truncated` return + the service backfill loop).
      const bearer = await mintUserAccessToken(userUuid);
      const itemAccounts = await fetchItemAccounts(userUuid, providerItemId);
      // accountId → STABLE accountKey: refresh maps txns to the deduped local
      // account via this key, not the volatile Bridge id.
      const accountKeyById = new Map(itemAccounts.map((a) => [String(a.id), bridgeAccountKey(a)]));

      interface TxnRow {
        id: number;
        account_id: number;
        amount: number;
        clean_description?: string;
        provider_description?: string;
        category_id: number | null;
        date: string;
        updated_at: string;
        deleted?: boolean;
      }
      interface TxnPage {
        resources: TxnRow[];
        pagination?: { next_uri?: string | null };
      }

      const PAGE_LIMIT = 500;
      const MAX_PAGES = 100; // ≤ 50k rows/tick (NFR-15) — guards an unbounded cursor.
      const first = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      // `since` bounds the window below (updated_at > since); `until` bounds it
      // above (updated_at < until). The reverse-chronological order means the
      // cursor walks DOWNWARD in time from `until` (or now) toward `since`, so
      // a truncated tick fetched the NEWEST slice and the caller resumes the
      // still-older slice next tick by passing `until = oldestUpdatedAt`
      // (bug-fix 2026-06-12 — see the BankProvider.listTransactions contract).
      if (since) first.set("since", since.toISOString());
      if (until) first.set("until", until.toISOString());
      let nextPath: string | null = `/v3/aggregation/transactions?${first.toString()}`;

      const rows: TxnRow[] = [];
      let pages = 0;
      while (nextPath && pages < MAX_PAGES) {
        // oxlint-disable-next-line no-await-in-loop -- serial by design: cursor pagination follows next_uri from the previous response
        const page: TxnPage = await reqJson<TxnPage>(nextPath, { method: "GET", bearer });
        rows.push(...page.resources);
        // Bridge sometimes returns the STRING "null" for next_uri rather than
        // JSON null (see docs/ressources/Bridge API.postman_collection.json) —
        // a non-empty string is truthy, so guard it explicitly or we'd follow
        // "/...null" → 404 and abort an otherwise-successful refresh.
        const next = page.pagination?.next_uri;
        nextPath = next && next !== "null" ? next : null;
        pages += 1;
      }
      // `truncated` is true iff the per-tick page cap stopped the cursor BEFORE
      // Bridge signalled `next_uri = null`. We no longer just warn-and-drop the
      // unfetched pages: we report the truncation + the oldest `updated_at`
      // reached so the service drains the remaining (still-older) slice with
      // `until = oldestUpdatedAt` — no silent permanent loss (bug-fix 2026-06-12).
      const truncated = nextPath !== null;
      if (truncated) {
        console.warn(
          `[bridge-client] listTransactions hit MAX_PAGES=${MAX_PAGES} for item_id=${providerItemId} — reporting truncated:true so the service resumes the older slice next slice/tick`,
        );
      }

      // Bridge v3 — `clean_description` is the friendly label ("CB Carrefour"),
      // `provider_description` is the raw bank string ("PAIEMENT CB ..."). Both
      // can be empty for some operation_types — fall back to "Transaction
      // bancaire" so Prisma's non-null `label` constraint never trips. We skip
      // deleted=true rows (Bridge soft-deletes via this flag) and rows whose
      // account does not belong to this item (the item_id-ignored guard above).
      // `latest`/`oldest` are computed over the FILTERED rows only so the dedup
      // cursor + the resume bound never key on another item's transactions.
      let latest: Date | null = null;
      let oldest: Date | null = null;
      const transactions = rows
        .filter((r) => !r.deleted && accountKeyById.has(String(r.account_id)))
        .map((r) => {
          const updatedAt = new Date(r.updated_at);
          if (!latest || updatedAt > latest) latest = updatedAt;
          if (!oldest || updatedAt < oldest) oldest = updatedAt;
          const label =
            r.clean_description?.trim() || r.provider_description?.trim() || "Transaction bancaire";
          return {
            providerTransactionId: String(r.id),
            providerAccountId: String(r.account_id),
            accountKey: accountKeyById.get(String(r.account_id))!,
            occurredOn: new Date(r.date),
            amount: r.amount,
            label,
            rawCategory: r.category_id !== null ? String(r.category_id) : null,
            updatedAt,
          } satisfies ProviderTransaction;
        });
      return { transactions, latestUpdatedAt: latest, oldestUpdatedAt: oldest, truncated };
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

    async getProviderLogo(providerId) {
      // Bridge v3 — GET /v3/providers/:id (the public bank directory; NOT under
      // /v3/aggregation, no user Bearer — authHeaders' Client-Id/Secret suffice).
      // allowStatuses:[404] so an unknown provider_id resolves to null instead
      // of throwing bankProviderUnavailable. Response: { id, images: { logo } }.
      const { data, status } = await req<{ images?: { logo?: string | null } }>(
        `/v3/providers/${encodeURIComponent(providerId)}`,
        { method: "GET", allowStatuses: [404] },
      );
      if (status === 404) return { logoUrl: null };
      return { logoUrl: data.images?.logo ?? null };
    },
  };
}
