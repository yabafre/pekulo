// apps/api/src/modules/logos/services/brandfetch-client.ts
// Story 6-10 (FR-65). Outbound HTTP to Brandfetch — iso-pattern with
// bank-aggregator/services/bridge-client.ts. SERVER-SIDE ONLY: the API key
// lives in Dokploy env (apps/api), never in apps/web, never in fixtures
// (gitleaks pre-commit covers leaks). Brand Search API: free-text name → best
// brand match → icon/logo URL.
//
// Returns null (never throws) on miss / non-2xx / timeout so the caller can
// negative-cache and fall through to the bank logo. Logo resolution must never
// break a transaction read.

import type { Env } from "../../../config/env";

const BRANDFETCH_TIMEOUT_MS = 5_000;

export interface BrandfetchClient {
  /** Resolve a merchant query to a logo URL, or null when unresolved. */
  resolveLogoUrl(merchantQuery: string): Promise<string | null>;
}

interface BrandSearchHit {
  name: string;
  domain: string;
  // Brandfetch search returns `icon` (favicon-grade) on the search hit; the
  // brand logo CDN link is derivable from the domain. Prefer `icon` when
  // present, else the domain logo-link CDN URL.
  icon?: string | null;
}

export function createBrandfetchClient(args: { env: Env }): BrandfetchClient {
  const { env } = args;
  return {
    async resolveLogoUrl(merchantQuery) {
      if (!env.BRANDFETCH_API_KEY) return null; // unconfigured → graceful no-op
      const base = env.BRANDFETCH_SEARCH_BASE.replace(/\/$/, "");
      const url = `${base}/${encodeURIComponent(merchantQuery)}`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.BRANDFETCH_API_KEY}`,
            accept: "application/json",
          },
          signal: AbortSignal.timeout(BRANDFETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const hits = (await res.json()) as BrandSearchHit[];
        const top = Array.isArray(hits) ? hits[0] : undefined;
        if (!top) return null;
        if (top.icon) return top.icon;
        if (top.domain && env.BRANDFETCH_LOGO_CLIENT_ID) {
          return `${env.BRANDFETCH_LOGO_BASE.replace(/\/$/, "")}/${top.domain}?c=${env.BRANDFETCH_LOGO_CLIENT_ID}`;
        }
        return null;
      } catch {
        return null; // timeout / network — negative-cache, fall through to bank logo
      }
    },
  };
}
