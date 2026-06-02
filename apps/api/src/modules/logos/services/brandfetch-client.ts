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

// Bank labels are noisy, and Brandfetch's search returns [] for over-specific
// multi-word queries ("carrefour city", "matmut rouen", "paypal docusigninc")
// while matching the bare brand. So we narrow to shrinking PREFIXES (the brand
// usually leads; the trailing token is a city / reference). A single-token
// prefix must be ≥ 5 chars — short tokens ("sc", "doe") match random brands.
const MIN_SINGLE_TOKEN = 5;
const MAX_QUERY_CANDIDATES = 4;

function candidateQueries(query: string): string[] {
  const tokens = query.split(/\s+/).filter(Boolean);
  const out: string[] = [query];
  for (let n = tokens.length - 1; n >= 1; n--) {
    if (n === 1 && tokens[0]!.length < MIN_SINGLE_TOKEN) continue;
    out.push(tokens.slice(0, n).join(" "));
  }
  return [...new Set(out)].filter(Boolean).slice(0, MAX_QUERY_CANDIDATES);
}

const alnum = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Relevance guard: the matched brand's NAME or DOMAIN must start with the query
// — kills the false-positive class the narrowing would otherwise admit ("doe" →
// "U.S. Department of Energy", "commission" → "Care Quality Commission", "mad" →
// "Steve Madden"), while keeping real brands whose official name carries a
// prefix/suffix via the domain ("biocoop" → biocoop.fr, "allianz" → allianz.com).
function isRelevant(query: string, hit: BrandSearchHit): boolean {
  const q = alnum(query);
  if (!q) return false;
  return alnum(hit.name ?? "").startsWith(q) || alnum(hit.domain ?? "").startsWith(q);
}

export function createBrandfetchClient(args: { env: Env }): BrandfetchClient {
  const { env } = args;

  async function searchTopLogo(query: string): Promise<string | null> {
    const base = env.BRANDFETCH_SEARCH_BASE.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/${encodeURIComponent(query)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.BRANDFETCH_API_KEY}`, accept: "application/json" },
        signal: AbortSignal.timeout(BRANDFETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const hits = (await res.json()) as BrandSearchHit[];
      const top = Array.isArray(hits) ? hits[0] : undefined;
      if (!top || !isRelevant(query, top)) return null;
      if (top.icon) return top.icon;
      if (top.domain && env.BRANDFETCH_LOGO_CLIENT_ID) {
        return `${env.BRANDFETCH_LOGO_BASE.replace(/\/$/, "")}/${top.domain}?c=${env.BRANDFETCH_LOGO_CLIENT_ID}`;
      }
      return null;
    } catch {
      return null; // timeout / network — caller negative-caches, falls to bank logo
    }
  }

  return {
    async resolveLogoUrl(merchantQuery) {
      if (!env.BRANDFETCH_API_KEY) return null; // unconfigured → graceful no-op
      for (const q of candidateQueries(merchantQuery)) {
        // oxlint-disable-next-line no-await-in-loop -- serial by design: stop at the first candidate that resolves
        const logo = await searchTopLogo(q);
        if (logo) return logo;
      }
      return null;
    },
  };
}
