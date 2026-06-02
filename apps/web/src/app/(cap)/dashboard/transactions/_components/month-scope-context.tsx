"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/month-scope-context.tsx
// Story 6-9 (FR-64) — the SINGLE source of the active month, shared by the
// navigator, the stat cards and the Récentes list. URL is the SSOT (`?month=`)
// via nuqs so the view is shareable + back-button-correct (AC-5). The default
// is DYNAMIC (server-resolved latest activity month), so we do NOT use a static
// parser default: month = (valid ?month) ?? summary.month. The default is never
// written to the URL on mount (no effect, no parasitic history entry) — the
// first prev/next click writes the concrete month with history:"push".
//
// nuqs reads useSearchParams under the hood → this provider MUST render under a
// <Suspense> ancestor (page.tsx, T15) or the whole route bails to CSR
// (lesson 2026-05-26). Requires <NuqsAdapter> at the app root (layout.tsx, T16).

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { parseAsString, useQueryState } from "nuqs";
import type { MonthSummaryOutput } from "@pekulo/validators";
import { useMonthSummary } from "../_hooks/use-month-summary";
import { isMonthKey, shiftMonth } from "./month-key";

export interface MonthScope {
  /** Active month "YYYY-MM". null only on the first paint before the summary
   *  resolves AND the URL is empty. */
  month: string | null;
  summary: MonthSummaryOutput | undefined;
  isLoading: boolean;
  setMonth: (month: string) => void;
  goPrev: () => void;
  goNext: () => void;
}

const MonthScopeContext = createContext<MonthScope | null>(null);

export function MonthScopeProvider({ children }: { children: ReactNode }) {
  const [rawMonth, setRawMonth] = useQueryState("month", parseAsString);
  const urlMonth = isMonthKey(rawMonth) ? rawMonth : null;
  // month omitted → server resolves the latest activity month (or current
  // calendar month). A valid ?month is passed through so the summary + Récentes
  // share the same scope.
  const { data: summary, isLoading } = useMonthSummary(urlMonth ?? undefined);
  const month = urlMonth ?? summary?.month ?? null;

  const value = useMemo<MonthScope>(() => {
    // history:"push" so Back returns to the previously viewed month (AC-5).
    const setMonth = (next: string) => void setRawMonth(next, { history: "push" });
    return {
      month,
      summary,
      isLoading,
      setMonth,
      goPrev: () => {
        if (month) setMonth(shiftMonth(month, -1));
      },
      goNext: () => {
        if (month) setMonth(shiftMonth(month, 1));
      },
    };
  }, [month, summary, isLoading, setRawMonth]);

  return <MonthScopeContext.Provider value={value}>{children}</MonthScopeContext.Provider>;
}

export function useMonthScope(): MonthScope {
  const ctx = useContext(MonthScopeContext);
  if (!ctx) throw new Error("useMonthScope must be used within <MonthScopeProvider>");
  return ctx;
}
