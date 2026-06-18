// apps/web/src/app/(cap)/dashboard/layout.tsx
// Server Component — fetches the supabase user behind the auth guard,
// then delegates the Cap-view chrome (sidebar + topbar) to a `"use client"`
// shell (`CapShell`). The chrome is client-only because it consumes
// `useRouter` (settings navigation), `useToast` (bientôt advisories), and
// `PekuloNavRail` (Tamagui surfaces). The server boundary stays here so
// the auth check + email lookup don't ship to the client bundle.
import { redirect } from "next/navigation";
import type { LangPref, ThemePref } from "@pekulo/validators";
import { createClient } from "@/lib/supabase/server";
import { settingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { CapShell } from "./_components/cap-shell";
import { PreferenceHydrator } from "../_components/preference-hydrator";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Story 8-2 AC-6 — read the server pref so the hydrator can apply it on the
  // first authenticated render of a fresh device. A failed read must NOT 500
  // the whole dashboard (the defaults are the same getOrCreate values the
  // service would return), so it degrades to system/fr.
  let pref: { theme: ThemePref; lang: LangPref } = { theme: "system", lang: "fr" };
  try {
    await ensureRequestContext();
    pref = await settingsClient.get();
  } catch {
    // keep the defaults — the live next-theme/next-intl state still renders.
  }

  return (
    <CapShell email={user.email ?? null}>
      <PreferenceHydrator pref={pref} />
      {children}
    </CapShell>
  );
}
