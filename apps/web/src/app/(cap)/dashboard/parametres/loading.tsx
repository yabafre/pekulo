// apps/web/src/app/(cap)/dashboard/parametres/loading.tsx
// Next.js loading boundary — renders during the initial RSC fetch so the
// page never lands blank. Mirrors the page container shape (centered,
// maxWidth 720, gap-6 column) and uses PekuloSkeleton inside Section, like
// dashboard/transactions/mensuel loading files.

import { PekuloSkeleton, Section, pekuloSpacing } from "@pekulo/ui";

export default function ParametresLoading() {
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
        <Section ariaLabel="Chargement des paramètres">
          <PekuloSkeleton width="50%" height={12} />
          <div style={{ height: 12 }} />
          <PekuloSkeleton block height={120} />
        </Section>
        <Section ariaLabel="Chargement de l'historique">
          <PekuloSkeleton lines={3} height={36} />
        </Section>
      </div>
    </div>
  );
}
