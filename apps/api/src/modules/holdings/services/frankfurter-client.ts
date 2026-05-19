// Tier-unique FX provider — HTTP to api.frankfurter.app (public, no auth).
// Port of apps/web/src/lib/services/fx.ts.
//
// Diffs vs brownfield:
//   - Factory pattern (createFrankfurterClient(deps)) — no module-level
//     cache or process.env access. Caller owns caching policy (24 h in the
//     brownfield; 3-3 keeps the client stateless and lets 7-1 decide).
//   - AbortSignal.timeout(timeoutMs) injected — brownfield had no timeout,
//     which silently violated the "best-effort, ≤ 50 ms fallback" budget
//     (NFR-19) on slow networks. Default 1500 ms (Frankfurter typical p99).
//   - isConfigured: boolean — mirrors PricesClient precedent (3-2). The
//     caller short-circuits when false and stamps `fxSource: 'fallback'`.
//   - HOLDING_CURRENCIES whitelist — the wire payload may include foreign
//     keys we do not model (JPY, AUD, …). Drop them at parse time so the
//     downstream FxRates literal stays sound.

import { type FxRates, HOLDING_CURRENCIES, type HoldingCurrency } from "@pekulo/validators";

export type FrankfurterErrorCode = "not-configured" | "network" | "format";

export class FrankfurterError extends Error {
  override readonly name = "FrankfurterError";
  readonly code: FrankfurterErrorCode;
  constructor(code: FrankfurterErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface FrankfurterClient {
  /**
   * True when FRANKFURTER_BASE_URL is set. The caller short-circuits when
   * false and stamps `fxSource: 'fallback'` (1:1 identity).
   */
  isConfigured: boolean;
  /**
   * Fetch the latest rates with `base` as the reference (1 unit of base = X
   * foreign). Resolves to an FxRates with `rates[base] === 1` stamped on
   * read. Rejects with FrankfurterError on network/format/timeout.
   */
  getRates(base: HoldingCurrency): Promise<FxRates>;
}

export interface CreateFrankfurterClientDeps {
  baseUrl: string | undefined;
  timeoutMs?: number;
}

export function createFrankfurterClient(deps: CreateFrankfurterClientDeps): FrankfurterClient {
  const timeoutMs = deps.timeoutMs ?? 1_500;
  return {
    isConfigured: Boolean(deps.baseUrl),
    async getRates(base) {
      const baseUrl = deps.baseUrl;
      if (!baseUrl) {
        throw new FrankfurterError("not-configured", "FRANKFURTER_BASE_URL non défini.");
      }
      const others = HOLDING_CURRENCIES.filter((c) => c !== base);
      const url = `${baseUrl.replace(/\/$/, "")}/latest?base=${encodeURIComponent(
        base,
      )}&symbols=${others.map((c) => encodeURIComponent(c)).join("%2C")}`;

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new FrankfurterError(
          "network",
          `Frankfurter unreachable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!res.ok) {
        throw new FrankfurterError("network", `Frankfurter HTTP ${res.status}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new FrankfurterError("format", "Frankfurter: réponse non-JSON.");
      }

      const obj = json as { date?: unknown; rates?: unknown };
      if (!obj.rates || typeof obj.rates !== "object") {
        throw new FrankfurterError("format", "Frankfurter: champ rates absent.");
      }
      if (typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
        throw new FrankfurterError("format", "Frankfurter: champ date absent ou mal formé.");
      }

      const wireRates = obj.rates as Record<string, unknown>;
      const rates: Partial<Record<HoldingCurrency, number>> = { [base]: 1 };
      for (const c of others) {
        const raw = Number(wireRates[c]);
        if (Number.isFinite(raw) && raw > 0) rates[c] = raw;
      }
      return {
        base,
        date: obj.date,
        rates: rates as FxRates["rates"],
      };
    },
  };
}
