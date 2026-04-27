import { Card, CardContent } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import { CapitalChart } from "@/components/charts/capital-chart"
import { BudgetChart } from "@/components/charts/budget-chart"
import { ScenarioChart } from "@/components/charts/scenario-chart"
import { RevenuChart } from "@/components/charts/revenu-chart"
import { AnnualSummaryChart } from "@/components/charts/annual-chart"
import { Phases } from "@/components/phases"
import { DetailCards } from "@/components/detail-cards"
import { AnnualTable } from "@/components/annual-table"
import { phases } from "@/lib/config"
import {
  deriveAnnualSummaries,
  deriveBudget,
  deriveKpis,
  deriveMonthly,
  deriveRevenue,
  deriveScenarios,
} from "@/lib/derive"
import { readHypotheses } from "@/lib/data/hypotheses"
import { readPortfolioSnapshot } from "@/lib/data/portfolio"

export const dynamic = "force-dynamic"

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " €"
}

export default async function DashboardPage() {
  const [{ hypotheses }, portfolio] = await Promise.all([
    readHypotheses(),
    readPortfolioSnapshot(),
  ])
  const kpiData = deriveKpis(hypotheses)
  const monthlyData = deriveMonthly(hypotheses)
  const annualSummaries = deriveAnnualSummaries(hypotheses)
  const scenarios = deriveScenarios(hypotheses)
  const budgetData = deriveBudget(hypotheses)
  const revenueData = deriveRevenue(hypotheses)
  const capitalActuel = portfolio.kpi.capitalTotal
  const progressionActuelle = kpiData.objectif > 0 ? Math.round((capitalActuel / kpiData.objectif) * 1000) / 10 : 0

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Net réel / Mois" value={formatEuro(kpiData.netReel)} sub="Salaire net mensuel" />
        <KpiCard label="Pouvoir d'achat réel" value={formatEuro(kpiData.pouvoirAchat)} sub="Net + avantages (+243 €)" />
        <KpiCard label="Épargne / Mois" value={formatEuro(kpiData.epargneMois)} sub="32,7% du net (Phase 1)" />
        <KpiCard label="Capital Projeté 5 ans" value={formatEuro(kpiData.capitalProjete)} sub={`Objectif ${formatEuro(kpiData.objectif)} — ${kpiData.progression}%`} />
        <KpiCard label="Capital Actuel" value={formatEuro(capitalActuel)} sub={`Réel — ${progressionActuelle}% objectif`} />
      </div>

      {/* Progress bar — actual vs objective */}
      {(() => {
        const actuelPct = Math.min(100, progressionActuelle)
        const projetePct = Math.min(100, kpiData.progression)
        const objectifAtteint = progressionActuelle >= 100
        const projeteAuDessus = kpiData.progression > 100
        return (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <p className="text-sm font-medium">
                  Avancement vers l&apos;objectif {formatEuro(kpiData.objectif)}
                </p>
                {objectifAtteint ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                    Objectif atteint · +{formatEuro(capitalActuel - kpiData.objectif)}
                  </span>
                ) : projeteAuDessus ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
                    Trajectoire 5 ans dépasse l&apos;objectif
                  </span>
                ) : null}
              </div>

              {/* Stacked bar: actual filled, then a translucent projected overlay up to 100% */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--chart-3)]/35 transition-all"
                  style={{ width: `${projetePct}%` }}
                  aria-hidden
                />
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${objectifAtteint ? "bg-emerald-500" : "bg-[var(--chart-1)]"}`}
                  style={{ width: `${actuelPct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs mt-3">
                <div>
                  <p className="text-muted-foreground">Capital actuel</p>
                  <p className={`font-semibold tabular-nums ${objectifAtteint ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {formatEuro(capitalActuel)}{" "}
                    <span className="text-muted-foreground font-normal">· {progressionActuelle}%</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projeté 5 ans</p>
                  <p className="font-semibold tabular-nums">
                    {formatEuro(kpiData.capitalProjete)}{" "}
                    <span className="text-muted-foreground font-normal">· {kpiData.progression}%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Objectif</p>
                  <p className="font-semibold tabular-nums">{formatEuro(kpiData.objectif)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <CapitalChart data={monthlyData} />
        </div>
        <BudgetChart data={budgetData} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ScenarioChart data={scenarios} />
        <RevenuChart data={revenueData} total={kpiData.pouvoirAchat} />
      </div>

      {/* Phases */}
      <Phases phases={phases} />

      {/* Detail Cards */}
      <DetailCards hypotheses={hypotheses} />

      {/* Annual summary + table */}
      <AnnualSummaryChart data={annualSummaries} />
      <AnnualTable data={annualSummaries} />
    </div>
  )
}
