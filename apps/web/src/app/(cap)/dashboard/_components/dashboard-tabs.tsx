"use client";

// Client wrapper that owns the `?tab=patrimoine` branch. The parent
// `page.tsx` stays RSC so the shell is server-rendered; this component
// holds the single `useSearchParams()` call required by the URL toggle
// declared in `cap-shell.tsx`. Mirrors the Pawly canonical flow
// (Page RSC → Client Component → ...).

import { useSearchParams } from "next/navigation";
import { CapView } from "./cap-view";
import { PatrimoineView } from "./patrimoine-view";

export function DashboardTabs() {
  const params = useSearchParams();
  const tab = params.get("tab");
  if (tab === "patrimoine") return <PatrimoineView />;
  return <CapView />;
}
