// apps/web/src/app/(auth)/recover/page.tsx
// Password recovery (FR-48). Server Component: picks the mode from the session
// plus the recovery marker the callback set. No session → request-email form.
// Recovery session (arrived via the email link → callback set the httpOnly
// recovery marker, story 11-7 httpOnly cookies) → set-new-password form. A
// normal authenticated user (full session, no marker) is bounced to /dashboard:
// /recover is not a password-change surface for already-logged-in users
// (aped-review M1). Detection is server-side because the session cookie is
// httpOnly and unreadable by the browser client.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecoverForm } from "@/components/recover-form";
import { RECOVERY_MARKER_COOKIE } from "../recovery-marker";

export default async function RecoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <RecoverForm mode="request" />;

  const isRecovery = (await cookies()).get(RECOVERY_MARKER_COOKIE)?.value === "1";
  if (!isRecovery) redirect("/dashboard");

  return <RecoverForm mode="reset" />;
}
