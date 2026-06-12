// apps/web/src/app/(cap)/dashboard/page.tsx
// RSC shell — delegates the entire screen to `<DashboardTabs/>`, the
// Client Component that owns the `?tab=patrimoine` switch. Keeping the
// page itself server-rendered aligns with the Pawly contract (every
// Page is RSC) and lets future server-side helpers (auth gating,
// streaming boundaries, metadata) plug in without a "use client" flip.

import { Suspense } from "react";
import { DashboardTabs } from "./_components/dashboard-tabs";
import DashboardLoading from "./loading";

export default function DashboardPage() {
  // Reuse the segment's loading.tsx skeleton as the Suspense fallback so a
  // suspending client subtree paints the PekuloSkeleton shell rather than a
  // blank gap (was `fallback={null}`).
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardTabs />
    </Suspense>
  );
}
