// apps/web/src/app/(cap)/dashboard/layout.tsx
// Server Component — fetches the supabase user behind the auth guard,
// then delegates the Cap-view chrome (sidebar + topbar) to a `"use client"`
// shell (`CapShell`). The chrome is client-only because it consumes
// `useRouter` (settings navigation), `useToast` (bientôt advisories), and
// `PekuloNavRail` (Tamagui surfaces). The server boundary stays here so
// the auth check + email lookup don't ship to the client bundle.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CapShell } from "./_components/cap-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <CapShell email={user.email ?? null}>{children}</CapShell>;
}
