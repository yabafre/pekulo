// apps/web/src/app/dashboard/loading.tsx
// Server-render path. Plain HTML wrapper; the @pekulo/ui primitives mount
// their own client boundary.
import { PekuloSkeleton, Section, pekuloSpacing } from "@pekulo/ui";

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        padding: pekuloSpacing[4],
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <Section ariaLabel="Chargement">
          <PekuloSkeleton lines={3} height={20} />
          <div style={{ height: pekuloSpacing[4] }} />
          <PekuloSkeleton block height={140} />
        </Section>
      </div>
    </div>
  );
}
