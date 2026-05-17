"use client";

// apps/web/src/app/(cap)/dashboard/page.tsx
// Top-tab switch — `?tab=patrimoine` renders <PatrimoineView/>, default
// renders <CapView/>. The toggle UI lives in `cap-shell.tsx`. Story 2-3
// introduced the split.

import { useSearchParams } from "next/navigation";
import { CapView } from "./_components/cap-view";
import { PatrimoineView } from "./_components/patrimoine-view";

export default function DashboardPage() {
  const params = useSearchParams();
  const tab = params.get("tab");
  if (tab === "patrimoine") return <PatrimoineView />;
  return <CapView />;
}
