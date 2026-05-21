// apps/web/src/app/(cap)/dashboard/page.tsx
// RSC shell — delegates the entire screen to `<DashboardTabs/>`, the
// Client Component that owns the `?tab=patrimoine` switch. Keeping the
// page itself server-rendered aligns with the Pawly contract (every
// Page is RSC) and lets future server-side helpers (auth gating,
// streaming boundaries, metadata) plug in without a "use client" flip.

import { Suspense } from "react";
import { DashboardTabs } from "./_components/dashboard-tabs";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardTabs />
    </Suspense>
  );
}
