// apps/web/src/app/(spike)/tamagui-spike/page.tsx
// Server Component. Renders Tamagui primitives transitively through the provider.
// If Tamagui forces 'use client' here, AC-1 fails and the decision doc records pivot.

import { ProtoSlice } from "./proto-slice";

export default function TamaguiSpikePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "24px" }}>
      <h1 style={{ marginBottom: "16px", fontSize: "1.5rem" }}>
        Tamagui spike — W2 pre-flight
      </h1>
      <ProtoSlice
        totalWealthEur={147_320}
        compassPercentage={18.4}
        nextMilestoneDeltaEur={12_340}
        nextMilestoneLabel="Etape 2030 · 200 000 €"
      />
    </main>
  );
}
