import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Nav email={user.email} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
