// apps/web/src/app/(cap)/dashboard/parametres/page.tsx
// RSC shell — delegates every read to its Client children. Mirror of
// `portefeuille/page.tsx`: no `await` of oRPC clients, no props passed
// down. The two Client components (`<CompassEditForm/>`,
// `<CompassHistoryPanel/>`) subscribe to the relevant zapaction queries
// themselves, so mutations invalidating the compass tags propagate
// without a server round-trip.

import { pekuloSpacing } from "@pekulo/ui";
import { AccountSection } from "../_account/_components/account-section";
import { AppearanceSection } from "../_appearance/_components/appearance-section";
import { CompassEditForm } from "../_compass/_components/compass-edit-form";
import { CompassHistoryPanel } from "../_compass/_components/compass-history-panel";
import { LlmOptInToggle } from "../_llm/_components/llm-opt-in-toggle";
import { LlmActivityLogLink } from "../_llm/_components/llm-activity-log-link";
import { HypothesisSettings } from "../_hypothesis/_components/hypothesis-settings";

// Feature code is co-located by mount: accounts → dashboard/_account,
// appearance (theme/lang) → dashboard/_appearance, compass → dashboard/_compass.
// The Settings screen now hosts « Compte » (8-1) → « Apparence » (8-2, theme +
// language) → compass + LLM + hypothesis settings, in ux-preview order.

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
        <AccountSection />
        <AppearanceSection />
        <CompassEditForm />
        <CompassHistoryPanel />
        <LlmOptInToggle />
        <LlmActivityLogLink />
        <HypothesisSettings />
      </div>
    </div>
  );
}
