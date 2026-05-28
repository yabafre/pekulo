// apps/web/src/app/(cap)/dashboard/parametres/page.tsx
// RSC shell — delegates every read to its Client children. Mirror of
// `portefeuille/page.tsx`: no `await` of oRPC clients, no props passed
// down. The two Client components (`<CompassEditForm/>`,
// `<CompassHistoryPanel/>`) subscribe to the relevant zapaction queries
// themselves, so mutations invalidating the compass tags propagate
// without a server round-trip.

import { pekuloSpacing } from "@pekulo/ui";
import { CompassEditForm } from "./_components/compass-edit-form";
import { CompassHistoryPanel } from "./_components/compass-history-panel";

// Story 5-6 (post-review aped-review): the TEMP bank-connection affordance
// moved to /dashboard?tab=patrimoine (see _components/connect-bank-button.tsx
// + patrimoine-view.tsx). Parametres carries compass-only — the connections
// management UI lands in 5-7.

export default function ParametresPage() {
  return (
    <div
      style={{
        display: "flex",
        padding: pekuloSpacing[4],
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: pekuloSpacing[6],
        }}
      >
        <CompassEditForm />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}
