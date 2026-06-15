"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: true } | { ok: false; message: string };

// Never echo raw Supabase error strings — they can leak rate-limit hints /
// server details. Surface the bad-credentials case explicitly (UX); collapse
// everything else to a generic line.
function friendlySignInError(message: string): string {
  return message === "Invalid login credentials"
    ? "Email ou mot de passe incorrect"
    : "Connexion impossible. Réessaie plus tard.";
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: friendlySignInError(error.message) };
  return { ok: true };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  // Keep the sign-up error generic so it never reveals whether the email
  // already exists (account enumeration).
  if (error) return { ok: false, message: "Inscription refusée. Réessaie." };
  return { ok: true };
}
