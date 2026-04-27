import { readHypotheses } from "@/lib/data/hypotheses"
import { HypothesesForm } from "./_components/hypotheses-form"

export const dynamic = "force-dynamic"

export default async function ParametresPage() {
  const { hypotheses } = await readHypotheses()

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Édite les hypothèses qui pilotent ton dashboard. Tout y est recalculé après sauvegarde.
        </p>
      </div>
      <HypothesesForm initialValues={hypotheses} />
    </div>
  )
}
