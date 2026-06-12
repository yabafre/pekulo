// apps/web/src/app/(cap)/dashboard/immobilier/loading.tsx
// Next.js loading boundary — renders during the initial RSC fetch so the
// page never lands blank. Mirrors the page container shape (full-width,
// gap-24 column, 8/4 px padding) and uses PekuloSkeleton inside Section,
// like dashboard/transactions/mensuel loading files.

import { PekuloSkeleton, Section } from "@pekulo/ui";

export default function ImmobilierLoading() {
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
      <Section ariaLabel="Chargement de l'immobilier">
        <PekuloSkeleton width="40%" height={12} />
        <div style={{ height: 12 }} />
        <PekuloSkeleton block height={140} />
        <div style={{ height: 16 }} />
        <PekuloSkeleton lines={3} height={36} />
      </Section>
    </div>
  );
}
