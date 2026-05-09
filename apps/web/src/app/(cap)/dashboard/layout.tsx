// apps/web/src/app/dashboard/layout.tsx
// Server Component — fetches the supabase user. Uses plain HTML/CSS chrome
// (no Tamagui imports here) to keep the RSC boundary clean. Inner pages
// render Tamagui surfaces under "use client" boundaries inside their tree.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--color)",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <span style={{ color: "var(--color)", fontSize: 16, fontWeight: 600 }}>Pekulo</span>
        <span style={{ color: "var(--colorTertiary)", fontSize: 12 }}>{user.email}</span>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
