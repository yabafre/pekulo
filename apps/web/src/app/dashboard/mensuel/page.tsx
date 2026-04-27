import { readHypotheses } from "@/lib/data/hypotheses"
import { readMonthlyEntries } from "@/lib/data/monthly"
import { projectMonth } from "@/lib/derive-monthly"
import { monthRange } from "@/lib/schemas/monthly"
import type { MonthlyMerged } from "@/lib/types"
import { MonthlyList } from "./_components/monthly-list"

export const dynamic = "force-dynamic"

export default async function MensuelPage() {
  const [{ hypotheses }, actuals] = await Promise.all([
    readHypotheses(),
    readMonthlyEntries(),
  ])

  const actualByKey = new Map(
    actuals.map((entry) => [`${entry.year}-${entry.monthNum}`, entry])
  )

  const merged: MonthlyMerged[] = monthRange().map(({ year, monthNum, label }) => {
    const projected = projectMonth(hypotheses, year, monthNum)
    const actual = actualByKey.get(`${year}-${monthNum}`)
    if (actual) {
      return {
        ...actual,
        monthLabel: label,
        source: "actual",
        projected,
        ecart: actual.epargneMois - projected.epargneMois,
      }
    }
    return {
      ...projected,
      source: "projected",
      projected,
      ecart: 0,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Suivi mensuel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Saisis tes vrais chiffres mois par mois. Les lignes sans saisie utilisent la projection issue de tes paramètres.
        </p>
      </div>
      <MonthlyList initialData={merged} hypothesesSnapshot={hypotheses} />
    </div>
  )
}
