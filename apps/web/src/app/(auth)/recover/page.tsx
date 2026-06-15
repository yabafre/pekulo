// apps/web/src/app/(auth)/recover/page.tsx
// Password recovery (FR-48). Server Component: reads the Supabase session to
// pick the mode. A direct visit (no session) shows the request-email form;
// arriving from the email link (the callback established a recovery session,
// httpOnly cookie — story 11-7) shows the set-new-password form. Detection is
// server-side because the session cookie is httpOnly and unreadable by the
// browser client.
import { createClient } from "@/lib/supabase/server";
import { RecoverForm } from "@/components/recover-form";

export default async function RecoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <RecoverForm mode={user ? "reset" : "request"} />;
}
