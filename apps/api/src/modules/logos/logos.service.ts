// apps/api/src/modules/logos/logos.service.ts
// Story 6-10. Orchestrates the 3-tier resolution + the opaque proxy ref.
//   resolveMerchantLogo(label)  — tier 1, cache-first, negative-cached.
//   resolveProviderLogo(provId) — tier 2, cache-first, via BankProvider.
//   enrich(rows)                — read path: returns Map<txId, refToken|null>.
//   refToUpstreamUrl(ref)       — proxy: opaque ref → cached upstream URL (anti-SSRF).
// Resolution NEVER throws; misses negative-cache and fall through.

import { isResolvableMerchantKey, normalizeMerchantKey } from "./merchant-key";
import type { BrandfetchClient } from "./services/brandfetch-client";
import type { LogosRepository } from "./logos.repository";

// AC-5 refresh window — a cached row is NOT served forever. A negative entry
// ("resolved, none found") is retried after NEGATIVE_TTL so a merchant that was
// down / not-yet-indexed at first lookup can recover; a positive entry refreshes
// on the longer POSITIVE_TTL (brand/bank logos rarely change). Before the window
// elapses the row short-circuits the upstream call (bounds Brandfetch/Bridge cost
// + protects AC-5's "not looked up again before its refresh window elapses").
const NEGATIVE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days — retry a miss
const POSITIVE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days — refresh a hit

function isStale(row: { logoUrl: string | null; fetchedAt: Date }, now: Date): boolean {
  const age = now.getTime() - row.fetchedAt.getTime();
  return row.logoUrl === null ? age > NEGATIVE_TTL_MS : age > POSITIVE_TTL_MS;
}

// provider_id is encoded in account.providerAccountKey = "pid:{providerId}:{name}"
// (bridge-client bridgeAccountKey). IBAN-keyed accounts ("iban:...") have no
// provider_id here → no bank logo (tier-3 fallback). Pure parse, no I/O.
export function providerIdFromAccountKey(accountKey: string | null | undefined): string | null {
  if (!accountKey || !accountKey.startsWith("pid:")) return null;
  const parts = accountKey.split(":");
  const id = parts[1];
  return id && id !== "unknown" ? id : null;
}

// Opaque, URL-safe ref. "m:<merchantKey>" or "b:<providerId>" → base64url.
// NOT reversible to a URL by the client — it only indexes our cache.
function encodeRef(kind: "m" | "b", key: string): string {
  return Buffer.from(`${kind}:${key}`, "utf8").toString("base64url");
}
function decodeRef(ref: string): { kind: "m" | "b"; key: string } | null {
  try {
    const raw = Buffer.from(ref, "base64url").toString("utf8");
    const sep = raw.indexOf(":");
    if (sep < 1) return null;
    const kind = raw.slice(0, sep);
    const key = raw.slice(sep + 1);
    if ((kind !== "m" && kind !== "b") || !key) return null;
    return { kind, key };
  } catch {
    return null;
  }
}

export interface EnrichRow {
  id: string;
  label: string;
  provider: string | null;
  providerAccountKey: string | null;
  // Story 6-10 — the account's stored Bridge provider_id (the tier-2 source for
  // IBAN accounts, whose key carries none). Falls back to parsing the key for
  // legacy card rows created before the column existed.
  providerId?: string | null;
}

export interface LogosService {
  resolveMerchantLogo(label: string): Promise<string | null>;
  resolveProviderLogo(providerId: string): Promise<string | null>;
  /** Read path — gated on provider != null; returns the opaque proxy ref or null. */
  enrich(rows: EnrichRow[]): Promise<Map<string, string | null>>;
  /** Proxy path — opaque ref → server-resolved upstream URL (anti-SSRF), or null. */
  refToUpstreamUrl(ref: string): Promise<string | null>;
  /**
   * Warm the caches for a set of merchant labels + provider ids (the bank
   * refresh warm-up AND the historical backfill both funnel here). Serial +
   * best-effort: each miss negative-caches; a single failure is swallowed so a
   * warm run never aborts the rest. Returns how many of each were attempted.
   */
  warmMany(input: {
    labels?: string[];
    providerIds?: string[];
  }): Promise<{ merchants: number; providers: number }>;
}

export function createLogosService(deps: {
  repository: LogosRepository;
  brandfetch: BrandfetchClient;
  getBankLogo: (providerId: string) => Promise<string | null>; // BankProvider.getProviderLogo
  // Story 6-10 — factory-level clock seam (iso bank-aggregator) so the AC-5
  // refresh window is testable without a real timer. Defaults to wall-clock.
  clock?: () => Date;
}): LogosService {
  const now = (): Date => (deps.clock ? deps.clock() : new Date());

  async function resolveMerchantLogo(label: string): Promise<string | null> {
    const key = normalizeMerchantKey(label);
    if (!isResolvableMerchantKey(key)) return null;
    const cached = await deps.repository.getMerchant(key);
    // Fresh hit (positive OR negative) short-circuits; a stale row falls through
    // to a re-resolve so a once-failed merchant recovers after its window (AC-5).
    if (cached !== undefined && !isStale(cached, now())) return cached.logoUrl;
    const resolved = await deps.brandfetch.resolveLogoUrl(key);
    await deps.repository.upsertMerchant(key, resolved); // negative-cache on null
    return resolved;
  }

  async function resolveProviderLogo(providerId: string): Promise<string | null> {
    const cached = await deps.repository.getProvider(providerId);
    if (cached !== undefined && !isStale(cached, now())) return cached.logoUrl;
    const resolved = await deps.getBankLogo(providerId);
    await deps.repository.upsertProvider(providerId, resolved);
    return resolved;
  }

  return {
    resolveMerchantLogo,
    resolveProviderLogo,
    async enrich(rows) {
      const out = new Map<string, string | null>();
      for (const row of rows) {
        if (row.provider == null) {
          out.set(row.id, null); // manual transaction → category icon (AC-3)
          continue;
        }
        const key = normalizeMerchantKey(row.label);
        let ref: string | null = null;
        if (isResolvableMerchantKey(key)) {
          // oxlint-disable-next-line no-await-in-loop -- serial by design: bounded page of rows, cache-only lookup
          const m = await deps.repository.getMerchant(key);
          if (m?.logoUrl) ref = encodeRef("m", key); // tier 1
        }
        if (!ref) {
          const providerId = row.providerId ?? providerIdFromAccountKey(row.providerAccountKey);
          if (providerId) {
            // oxlint-disable-next-line no-await-in-loop -- serial by design: bounded page of rows, cache-only lookup
            const p = await deps.repository.getProvider(providerId);
            if (p?.logoUrl) ref = encodeRef("b", providerId); // tier 2
          }
        }
        out.set(row.id, ref); // null → tier 3 (category icon) in the UI
      }
      return out;
    },
    async refToUpstreamUrl(ref) {
      const decoded = decodeRef(ref);
      if (!decoded) return null; // 404 — never fetch a client-supplied URL (AC-5)
      const row =
        decoded.kind === "m"
          ? await deps.repository.getMerchant(decoded.key)
          : await deps.repository.getProvider(decoded.key);
      return row?.logoUrl ?? null;
    },
    async warmMany({ labels = [], providerIds = [] }) {
      for (const label of labels) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- serial best-effort warm: bounded set, each miss negative-caches
          await resolveMerchantLogo(label);
        } catch {
          /* one label's failure must never abort the warm batch */
        }
      }
      for (const providerId of providerIds) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- serial best-effort warm
          await resolveProviderLogo(providerId);
        } catch {
          /* swallow — best-effort */
        }
      }
      return { merchants: labels.length, providers: providerIds.length };
    },
  };
}
