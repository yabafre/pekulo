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
}

export interface LogosService {
  resolveMerchantLogo(label: string): Promise<string | null>;
  resolveProviderLogo(providerId: string): Promise<string | null>;
  /** Read path — gated on provider != null; returns the opaque proxy ref or null. */
  enrich(rows: EnrichRow[]): Promise<Map<string, string | null>>;
  /** Proxy path — opaque ref → server-resolved upstream URL (anti-SSRF), or null. */
  refToUpstreamUrl(ref: string): Promise<string | null>;
}

export function createLogosService(deps: {
  repository: LogosRepository;
  brandfetch: BrandfetchClient;
  getBankLogo: (providerId: string) => Promise<string | null>; // BankProvider.getProviderLogo
}): LogosService {
  async function resolveMerchantLogo(label: string): Promise<string | null> {
    const key = normalizeMerchantKey(label);
    if (!isResolvableMerchantKey(key)) return null;
    const cached = await deps.repository.getMerchant(key);
    if (cached !== undefined) return cached.logoUrl; // hit (positive OR negative)
    const resolved = await deps.brandfetch.resolveLogoUrl(key);
    await deps.repository.upsertMerchant(key, resolved); // negative-cache on null
    return resolved;
  }

  async function resolveProviderLogo(providerId: string): Promise<string | null> {
    const cached = await deps.repository.getProvider(providerId);
    if (cached !== undefined) return cached.logoUrl;
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
          const providerId = providerIdFromAccountKey(row.providerAccountKey);
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
  };
}
