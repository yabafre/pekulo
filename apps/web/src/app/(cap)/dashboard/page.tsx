// apps/web/src/app/(cap)/dashboard/page.tsx — Cap view (FR-1 → FR-8 UI surfaces).
// Client Component: every child is a client island (CompassSection consumes
// React Query hooks). The auth gate lives in the layout (Server Component).
"use client";

import { CompassSection } from "./_components/compass-section";

export default function DashboardPage() {
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <CompassSection />
      </div>
    </div>
  );
}
