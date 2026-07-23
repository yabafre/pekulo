"use server";

import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  PASSWORD_POLICY_MESSAGE,
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signupSchema,
} from "@pekulo/validators";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_MARKER_COOKIE } from "../recovery-marker";

export type AuthResult = { ok: true } | { ok: false; message: string };

// Never echo raw Supabase error strings — they can leak rate-limit hints /
// server details (story 11-7). Surface the bad-credentials case explicitly
// (UX); collapse everything else — including the NFR-11 login rate-limit
// (10/IP/hour, Supabase-native) — to a generic line (AC-2).
async function friendlySignInError(message: string): Promise<string> {
  const t = await getTranslations("auth.signInError");
  return message === "Invalid login credentials" ? t("badCredentials") : t("generic");
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: await friendlySignInError(error.message) };
  return { ok: true };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  // Defense in depth: enforce the 12-char policy server-side too (FR-45 /
  // NFR-11 / AC-1). The client validates first for UX, but the action is the
  // trust boundary — a direct POST bypasses the form. The policy message is
  // surfaced explicitly here; every Supabase error stays generic so it never
  // reveals whether the email already exists (account enumeration).
  const parsed = signupSchema.safeParse({ email, password });
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "password");
    return { ok: false, message: issue?.message ?? PASSWORD_POLICY_MESSAGE };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const t = await getTranslations("auth");
    return { ok: false, message: t("signUpError") };
  }
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  // FR-47 / AC-3: invalidate the session immediately. The server client clears
  // the httpOnly auth cookies (story 11-7) via its setAll handler. The client
  // then redirects to /login.
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    const t = await getTranslations("auth");
    return { ok: false, message: t("signOutError") };
  }
  return { ok: true };
}

// Origin for the recovery-email redirect link. Prefer the explicit
// NEXT_PUBLIC_SITE_URL (stable behind proxies; Next 16 `headers()` is async —
// see apps/web/AGENTS.md). In production we REQUIRE it: the forwarded-host
// fallback trusts attacker-controllable headers, so building the reset-email
// link from them is a host-header-injection vector. The header fallback is
// dev-only (aped-review m3).
async function resolveOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production (password-reset redirect origin).",
    );
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3002";
  return `${proto}://${host}`;
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  // FR-48 / AC-4 (request mode). ALWAYS return ok — never reveal whether the
  // address maps to an account (enumeration). The reset link points at the
  // callback, which exchanges the code then redirects to /recover (reset
  // mode); `next` is sanitised by safe-redirect.ts.
  const parsed = passwordResetRequestSchema.safeParse({ email });
  if (!parsed.success) {
    const t = await getTranslations("auth");
    return { ok: false, message: t("emailInvalid") };
  }
  const supabase = await createClient();
  const origin = await resolveOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/callback?next=/recover`,
  });
  // The response is intentionally always { ok: true } to avoid account
  // enumeration (AC-4) — which also silently hides real failures (email rate
  // limit, redirect_to not allow-listed, SMTP errors, unknown address). Surface
  // the cause in the dev-server log only, without weakening the prod contract.
  if (error && process.env.NODE_ENV === "development") {
    console.warn("[auth] resetPasswordForEmail failed (dev-only, hidden from the user):", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
  }
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  // FR-48 / AC-4 (reset mode): set the new password using the recovery session
  // the callback established. Enforce the 12-char policy (AC-1 parity). On
  // success the session becomes a full session — the client redirects to
  // /dashboard.
  const parsed = passwordUpdateSchema.safeParse({ password });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? PASSWORD_POLICY_MESSAGE };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const t = await getTranslations("auth");
    return { ok: false, message: t("passwordUpdateError") };
  }
  // The recovery session is spent — drop the recovery marker so a later visit
  // to /recover with the (now full) session is bounced rather than re-shown the
  // reset form (aped-review M1).
  (await cookies()).delete(RECOVERY_MARKER_COOKIE);
  return { ok: true };
}
