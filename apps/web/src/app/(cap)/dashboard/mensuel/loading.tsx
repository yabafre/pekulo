// apps/web/src/app/(cap)/dashboard/mensuel/loading.tsx
// Next.js loading boundary — renders during the initial RSC fetch so the
// page never lands blank. Mirrors dashboard/loading.tsx and
// transactions/loading.tsx: PekuloSkeleton inside Section primitives,
// same shape as the loaded page.

import { PekuloSkeleton, Section } from "@pekulo/ui";
import topRowStyles from "./_components/mensuel-top-row.module.css";

export default function MensuelLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "8px 4px 0",
        width: "100%",
      }}
    >
      <div className={topRowStyles.row}>
        <Section ariaLabel="Chargement du mois en cours" className={topRowStyles.moisEnCours}>
          <PekuloSkeleton width="40%" height={12} />
          <div style={{ height: 12 }} />
          <PekuloSkeleton block height={48} />
        </Section>
        <Section ariaLabel="Chargement de la clôture" className={topRowStyles.cloture}>
          <PekuloSkeleton width="30%" height={12} />
          <div style={{ height: 12 }} />
          <PekuloSkeleton lines={2} height={14} />
        </Section>
      </div>
      <Section ariaLabel="Chargement de l'historique" title="Historique">
        <PekuloSkeleton lines={5} height={36} />
      </Section>
    </div>
  );
}
