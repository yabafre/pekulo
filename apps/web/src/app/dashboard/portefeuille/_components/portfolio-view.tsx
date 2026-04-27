"use client"

import { useMemo, useState } from "react"
import { useActionQuery } from "@zapaction/query"
import { Card, CardContent } from "@/components/ui/card"
import { AllocationChart } from "@/components/charts/allocation-chart"
import { computeSnapshotFx } from "@/lib/derive-portfolio-fx"
import type { PortfolioSnapshotFx } from "@/lib/derive-portfolio-fx"
import { getAccounts, getHoldings } from "@/lib/actions/portfolio"
import { portfolioKeys } from "@/lib/zapaction/keys"
import { AccountsSection } from "./accounts-section"
import { HoldingsSection } from "./holdings-section"

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €"
}

function formatSigned(n: number) {
  if (n === 0) return "0 €"
  const sign = n > 0 ? "+" : "−"
  return `${sign}${formatEuro(Math.abs(n))}`
}

export function PortfolioView({
  initialSnapshot,
}: {
  initialSnapshot: PortfolioSnapshotFx
}) {
  const [editingAccount, setEditingAccount] = useState<string | "new" | null>(null)
  const [editingHolding, setEditingHolding] = useState<string | "new" | null>(null)

  const accountsQuery = useActionQuery(getAccounts, {
    queryKey: portfolioKeys.accounts(),
    input: undefined,
    readPolicy: "read-only",
    initialData: initialSnapshot.accounts,
  })

  const holdingsQuery = useActionQuery(getHoldings, {
    queryKey: portfolioKeys.holdings(),
    input: undefined,
    readPolicy: "read-only",
    initialData: initialSnapshot.holdings,
  })

  // We don't refetch FX rates client-side — they only update once a day server-side.
  // Initial snapshot carries them; per-row table changes don't move them.
  const snapshot = useMemo<PortfolioSnapshotFx>(
    () =>
      computeSnapshotFx(
        accountsQuery.data ?? [],
        holdingsQuery.data ?? [],
        // Reconstruct a thin FxRates from initialSnapshot to keep client-side conversion consistent.
        // If FX wasn't available initially, every conversion stays 1:1.
        initialSnapshot.fxAvailable
          ? {
              base: initialSnapshot.fxBase,
              date: initialSnapshot.fxAsOf ?? "",
              rates: clientRatesFromInitial(initialSnapshot),
            }
          : null,
        initialSnapshot.fxBase
      ),
    [accountsQuery.data, holdingsQuery.data, initialSnapshot]
  )

  const allocationData = useMemo(
    () => snapshot.byAccount.map((a) => ({ label: a.label, value: a.total })),
    [snapshot.byAccount]
  )

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Capital total" value={formatEuro(snapshot.kpi.capitalTotal)} sub={`En ${snapshot.fxBase}`} />
        <Kpi label="Cash" value={formatEuro(snapshot.kpi.cash)} sub="Livret + AV + cash" />
        <Kpi label="Investi" value={formatEuro(snapshot.kpi.invested)} sub="Σ qty × prix moyen" />
        <Kpi label="Valeur titres" value={formatEuro(snapshot.kpi.marketValue)} sub="Σ qty × cours" />
        <Kpi
          label="+/− latente"
          value={formatSigned(snapshot.kpi.pnl)}
          accent={snapshot.kpi.pnl > 0 ? "emerald" : snapshot.kpi.pnl < 0 ? "destructive" : "muted"}
        />
      </div>

      {!snapshot.fxAvailable ? (
        <div className="text-xs px-3 py-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
          FX indisponible — taux 1:1 utilisés temporairement (frankfurter.app injoignable).
        </div>
      ) : null}

      <AllocationChart data={allocationData} />

      {snapshot.fxAvailable && snapshot.fxAsOf ? (
        <p className="text-xs text-muted-foreground -mt-3">
          Taux FX au {snapshot.fxAsOf} (source : frankfurter.app / ECB)
        </p>
      ) : null}

      <AccountsSection
        accounts={snapshot.accounts}
        editing={editingAccount}
        setEditing={setEditingAccount}
      />

      <HoldingsSection
        accounts={snapshot.accounts}
        holdings={snapshot.holdings}
        editing={editingHolding}
        setEditing={setEditingHolding}
      />
    </>
  )
}

/**
 * Reverse-engineer FX rates from the initial snapshot.
 * Server-side we have rates; we can't ship them through `PortfolioSnapshotFx` typed
 * payload as a Map cleanly, so we reconstruct from `byAccount` and `accounts`/`holdings`
 * native amounts: the ratio (totalInBase / totalInNative) per currency seen.
 *
 * Practical note: if no foreign currency holding exists, this returns an empty rates map
 * and `computeSnapshotFx` will identity-pass everything anyway. It only matters once the
 * user has multi-currency accounts.
 */
function clientRatesFromInitial(snap: PortfolioSnapshotFx) {
  const rates: Partial<Record<string, number>> = { [snap.fxBase]: 1 }
  // For each account, compute conv ratio from native cashBalance to the base contribution.
  const baseContribByAccount = new Map(snap.byAccount.map((a) => [a.accountId, a.total]))
  for (const a of snap.accounts) {
    if (a.currency === snap.fxBase || rates[a.currency]) continue
    const baseTotal = baseContribByAccount.get(a.id) ?? 0
    if (a.cashBalance > 0 && baseTotal > 0) {
      // baseTotal includes holding values; for a pure-cash account this gives a clean ratio.
      const holdingsValueNative = snap.holdings
        .filter((h) => h.accountId === a.id && h.currency === a.currency)
        .reduce((s, h) => s + h.quantity * h.lastPrice, 0)
      const cashContribBase = baseTotal - convertNative(holdingsValueNative, a.currency, rates, snap.fxBase)
      // ratio: 1 base = (cashBalance / cashContribBase) foreign
      if (cashContribBase > 0) {
        rates[a.currency] = a.cashBalance / cashContribBase
      }
    }
  }
  // For holdings on accounts already ratio-resolved above, no extra work.
  return rates
}

function convertNative(
  amount: number,
  from: string,
  rates: Partial<Record<string, number>>,
  base: string
): number {
  if (from === base) return amount
  const r = rates[from]
  if (!r || r <= 0) return amount
  return amount / r
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: "emerald" | "destructive" | "muted"
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "destructive"
        ? "text-destructive"
        : "text-foreground"
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}
