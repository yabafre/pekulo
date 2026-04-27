import { readPortfolioSnapshot } from "@/lib/data/portfolio"
import { PortfolioView } from "./_components/portfolio-view"

export const dynamic = "force-dynamic"

export default async function PortefeuillePage() {
  const snapshot = await readPortfolioSnapshot()

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Portefeuille</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tes comptes (Livret A / PEA / CTO / AV) et tes positions (ETF, actions). Saisie manuelle pour le moment, l&apos;intégration prix automatique arrive en qs-04b.
        </p>
      </div>
      <PortfolioView initialSnapshot={snapshot} />
    </div>
  )
}
