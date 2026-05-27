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
import { ConnectBankButton } from "./_components/connect-bank-button";

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
        <ConnectBankButton />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}
