// apps/api/src/modules/dashboard/fx-rates-source.ts
// Last-known-good caching layer over the FX provider (frankfurter-client).
//
// WHY: the dashboard converts USD/GBP/CHF holdings to EUR. The brownfield
// path did `getRates(...).catch(() => null)`, and computeSnapshotFx silently
// converts 1:1 when rates are null — so when Frankfurter is down, a USD
// holding was over-reported by ~8 % (the EUR/USD spread) with NO signal to
// the user. This wrapper removes that silent 1:1 fallback:
//
//   - success            → cache rates + stamp source "live".
//   - failure WITH cache  → serve the last-known-good rates + source "stale"
//                           (conversion still happens, never 1:1).
//   - failure NO cache    → rates null + source "unavailable" + a structured
//                           warn log. The 1:1 identity conversion still occurs
//                           (the dashboard must not 500 on a cold FX outage —
//                           NFR-18 spirit), but it is now EXPLICITLY surfaced
//                           via the source instead of being silent.
//
// The cache is in-memory / per-process (no persistence needed — a fresh
// "live" read on the next provider recovery overwrites it). It is keyed by
// `base` so a future multi-base read keeps independent last-known-good rows.

import type { FxRates, FxSource, HoldingCurrency } from "@pekulo/validators";

export interface FxRatesResult {
  /**
   * The rates to convert with, or null when the provider is down AND nothing
   * was ever cached (cold start). A null result maps to the 1:1 identity
   * conversion downstream, paired with source "unavailable".
   */
  rates: FxRates | null;
  /** Explicit provenance — see FX_SOURCES. Never "fallback" from this reader. */
  source: FxSource;
}

export interface FxRatesReader {
  /** Read rates for `base`, never throws — degrades to stale/unavailable. */
  read(base: HoldingCurrency): Promise<FxRatesResult>;
}

export interface CreateFxRatesReaderDeps {
  /** The underlying provider read (frankfurter-client.getRates). May reject. */
  getRates: (base: HoldingCurrency) => Promise<FxRates>;
  /**
   * Structured warn sink for the cold-start outage (cold FX miss). Defaults to
   * console.warn; injectable so tests can assert the log without spying on the
   * global console.
   */
  warn?: (message: string) => void;
}

export function createFxRatesReader(deps: CreateFxRatesReaderDeps): FxRatesReader {
  const warn = deps.warn ?? ((message: string) => console.warn(message));
  // Last-known-good rates per base. In-memory: a process restart re-cold-starts,
  // and the very next live read repopulates it.
  const lastKnownGood = new Map<HoldingCurrency, FxRates>();

  return {
    async read(base) {
      try {
        const rates = await deps.getRates(base);
        lastKnownGood.set(base, rates);
        return { rates, source: "live" };
      } catch (err) {
        const cached = lastKnownGood.get(base);
        if (cached) {
          // Provider down this read but we have a prior live snapshot — serve
          // it. Conversion stays correct (not 1:1); the "stale" source +
          // cached `date` let the UI flag the staleness.
          return { rates: cached, source: "stale" };
        }
        // Cold start + provider down: no rate ever cached. We keep the 1:1
        // identity behaviour (downstream sees rates: null) but make it EXPLICIT
        // and logged — never again a silent 1:1.
        warn(
          `[fx] rates unavailable (cold start, no cached rate for base=${base}): ${
            err instanceof Error ? err.message : String(err)
          } — converting 1:1, source=unavailable`,
        );
        return { rates: null, source: "unavailable" };
      }
    },
  };
}
