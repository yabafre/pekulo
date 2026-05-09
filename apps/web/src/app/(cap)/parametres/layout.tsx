// apps/web/src/app/(cap)/parametres/layout.tsx
// Sibling to (cap)/dashboard. Re-runs the auth guard (each segment is its
// own server boundary) and reuses the dashboard chrome.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ParametresLayout({ children }: { children: React.ReactNode }) {
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
        <span style={{ color: "var(--color)", fontSize: 16, fontWeight: 600 }}>
          Pekulo · Paramètres
        </span>
        <span style={{ color: "var(--colorTertiary)", fontSize: 12 }}>{user.email}</span>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
