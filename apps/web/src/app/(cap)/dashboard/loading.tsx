// apps/web/src/app/dashboard/loading.tsx
// Server-render path. Plain HTML wrapper; the @pekulo/ui primitives mount
// their own client boundary.
import { PekuloSkeleton, Section } from "@pekulo/ui";

export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <Section ariaLabel="Chargement">
          <PekuloSkeleton lines={3} height={20} />
          <div style={{ height: 16 }} />
          <PekuloSkeleton block height={140} />
        </Section>
      </div>
    </div>
  );
}
