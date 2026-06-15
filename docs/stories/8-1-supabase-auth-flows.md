# Story: 8-1-supabase-auth-flows — Supabase auth flows: signup, login, logout, password reset

**Epic:** Epic 8 — Auth & preferences
**Status:** review
**Ticket:** [#42](https://github.com/yabafre/pekulo/issues/42)
**Branch:** feature/42-8-1-supabase-auth-flows

## User Story

**As a** Pekulo user, **I want** to sign up with a 12-character password, log in with an SSR cookie session, log out from any page, and reset my password by email link, **so that** my account lifecycle is complete and secure.

## Acceptance Criteria

- **AC-1 (FR-45 / NFR-11)** — **Given** a signup submitted with a password shorter than 12 characters, **When** I submit, **Then** it is rejected with the message _« Le mot de passe doit contenir au moins 12 caractères. »_ before any account-creation request — and the same rejection holds server-side, so a request that bypasses the form cannot create a weak-password account. **And given** a password of ≥ 12 characters, **When** I submit, **Then** the account is created.
- **AC-2 (FR-46 / NFR-11)** — **Given** valid credentials, **When** I log in, **Then** the session is persisted as an httpOnly SSR cookie (story 11-7) and I land on `/dashboard`; **And given** the login is rate-limited (10 / IP / hour), **When** I attempt again, **Then** I see the sanitised generic line _« Connexion impossible. Réessaie plus tard. »_ and no internal rate-limit detail is exposed (preserves story 11-7's no-leak guarantee).
- **AC-3 (FR-47)** — **Given** an authenticated user on any `(cap)` page, **When** they open the user menu (avatar → Paramètres) and press « Se déconnecter », **Then** the session is invalidated immediately (the httpOnly auth cookies are cleared) and they are redirected to `/login`.
- **AC-4 (FR-48)** — **Given** the login page, **When** I follow « Mot de passe oublié ? » to `/recover` and submit my email, **Then** a reset email is sent and I see an enumeration-safe confirmation (no signal of whether the address has an account); **And given** I click the link in my inbox, **When** I land back on `/recover`, **Then** I can set a new password (≥ 12 chars) and am **immediately logged in** (redirected to `/dashboard`).
- **AC-5 (FR-46)** — **Given** an authenticated user, **When** they open Paramètres, **Then** the « Compte » section displays their email.
- **AC-6 (proxy / NFR-9)** — **Given** a recovery session, **When** the user is routed to `/recover`, **Then** the auth gate keeps them on `/recover` (it does **not** redirect them to `/dashboard`); **And given** no session, **When** any non-public path is requested, **Then** they are redirected to `/login` within the existing edge budget.

> **Scope note (realized expansion vs the epic's M estimate).** The epic framed 8-1 as a brownfield _reaffirmation_. At the step-04 design gate the user chose to **align the on-disk auth routes with `architecture.md`'s `(auth)` route group** (the brownfield ships flat `auth/`). This realizes a route-group **migration** (`auth/` → `(auth)/`, URLs `/auth/login` → `/login`, `/auth/signup` → `/signup`, `/auth/callback` → `/callback`, recover at `/recover`) on top of the new logout + password-reset work. Consequences, owned by this story (lesson 2026-05-31 — doc-debt paid in the same change): the **ticket #42 AC-3 URL `/auth/recover` is superseded → `/recover`**; the Supabase dashboard **redirect-URL allowlist must add `/callback`** (was `/auth/callback`) — see T13. A split was offered and declined (the work stays within the auth flow; no new persistence/table).

## Tasks

- [x] **T1 — Add the auth Zod schemas to `@pekulo/validators` (12-char policy SSOT) [AC: AC-1, AC-4]**
  Create `packages/validators/src/auth/auth.schemas.ts`:
  ```ts
  // packages/validators/src/auth/auth.schemas.ts
  // Auth-flow validators (story 8-1, FR-45 / NFR-11). Single source of truth for
  // the email + 12-char password policy, shared by the web auth forms (client
  // resolver) and the auth server actions (server-side trust boundary).
  //
  // Conventions: import `z` from @pekulo/zod (never "zod" directly — ADR-0011);
  // camelCase + `Schema` suffix; messages in French (communication_language).

  import { z } from "@pekulo/zod";

  /** NFR-11: minimum password length at signup / reset. */
  export const PASSWORD_MIN_LENGTH = 12;

  /** AC-1 policy message — surfaced by both the form and the signUp action. */
  export const PASSWORD_POLICY_MESSAGE = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;

  const email = z.string().trim().min(1, "Email requis").email("Email invalide");
  const strongPassword = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE);

  /** Signup: email + 12-char password (FR-45). */
  export const signupSchema = z.object({ email, password: strongPassword });

  /** Login: existing accounts — only require a non-empty password (FR-46). */
  export const loginSchema = z.object({
    email,
    password: z.string().min(1, "Mot de passe requis"),
  });

  /** Request a reset email (FR-48, request mode). */
  export const passwordResetRequestSchema = z.object({ email });

  /** Set a new password from the recovery session (FR-48, reset mode). */
  export const passwordUpdateSchema = z.object({ password: strongPassword });

  export type SignupInput = z.infer<typeof signupSchema>;
  export type LoginInput = z.infer<typeof loginSchema>;
  export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
  export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
  ```
  Create `packages/validators/src/auth/index.ts`:
  ```ts
  export * from "./auth.schemas";
  ```
  Edit `packages/validators/src/index.ts` — add the `auth` barrel line in alphabetical order, between `accounts` and `bank-aggregator`:
  ```ts
  export * from "./accounts";
  export * from "./auth";
  export * from "./bank-aggregator";
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0, no type errors.
  Commit: `git add packages/validators/src/auth packages/validators/src/index.ts && git commit -m "feat(#42): add auth Zod schemas with 12-char policy (FR-45)"`

- [x] **T2 — Migrate `auth/` → `(auth)/` route group + repoint every reference [AC: AC-2, AC-3, AC-4, AC-5, AC-6]**
  Move the whole auth tree into the architecture's `(auth)` route group (route groups are invisible in the URL → `/auth/login` becomes `/login`, etc.). Preserve git history with `git mv`:
  ```bash
  git mv "apps/web/src/app/auth" "apps/web/src/app/(auth)"
  ```
  Now repoint every reference found in the codebase (these are ALL of them — verified by `grep -rnE "/auth/|app/auth" apps/web/src`):

  1. `apps/web/src/components/auth-form.tsx` — line 9, change the action import:
     ```ts
     // before:
     import { signIn, signUp } from "@/app/auth/_actions/auth-actions";
     // after:
     import { signIn, signUp } from "@/app/(auth)/_actions/auth-actions";
     ```
     and the two intra-auth links (the « S'inscrire » / « Se connecter » `<Link href>`):
     ```tsx
     // before: href="/auth/signup"   →  after: href="/signup"
     // before: href="/auth/login"    →  after: href="/login"
     ```
  2. `apps/web/src/app/page.tsx` — line 10:
     ```ts
     // before:
     redirect("/auth/login");
     // after:
     redirect("/login");
     ```
  3. `apps/web/src/app/(cap)/dashboard/layout.tsx` — line 17:
     ```ts
     // before:
     if (!user) redirect("/auth/login");
     // after:
     if (!user) redirect("/login");
     ```
  4. `apps/web/src/app/(auth)/callback/route.ts` — line 18 (the error redirect target):
     ```ts
     // before:
     return NextResponse.redirect(`${origin}/auth/auth-code-error`);
     // after:
     return NextResponse.redirect(`${origin}/auth-code-error`);
     ```
  (The proxy is repointed in T3 — keep it out of this task.)
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0 — no broken `@/app/auth/*` imports remain (a missed reference fails typecheck here).
  Commit: `git add apps/web/src/app apps/web/src/components/auth-form.tsx && git commit -m "refactor(#42): migrate auth routes into the (auth) route group"`

- [x] **T3 — Rewrite the proxy auth-gate for the new public paths + `/recover` carve-out [AC: AC-6]**
  In `apps/web/src/app/(cap)/...` the auth gate lives at `apps/web/src/proxy.ts`. Replace the gate block (current lines 89–101, from `const pathname` through the closing `}` of the `if (!isStatic)` block) with:
  ```ts
    const pathname = request.nextUrl.pathname;
    // Public (auth) route-group paths — reachable without a session. The route
    // group `(auth)` is invisible in the URL, so these are bare top-level paths
    // (story 8-1 migrated `auth/` → `(auth)/`).
    const PUBLIC_AUTH_PATHS = new Set([
      "/login",
      "/signup",
      "/recover",
      "/callback",
      "/auth-code-error",
    ]);
    const isPublicAuthPath = PUBLIC_AUTH_PATHS.has(pathname);
    const isApi = pathname.startsWith("/api");
    const isStatic = pathname.startsWith("/_next") || pathname.includes(".");

    if (!isStatic) {
      if (!user && !isPublicAuthPath && !isApi && pathname !== "/") {
        return withSecurity(NextResponse.redirect(new URL("/login", request.url)));
      }
      // Bounce signed-in users off login/signup ONLY. NOT `/recover` — a
      // password-recovery session legitimately lands there to set a new
      // password (AC-6). NOT `/callback` — it must run its code exchange first.
      if (user && (pathname === "/login" || pathname === "/signup")) {
        return withSecurity(NextResponse.redirect(new URL("/dashboard", request.url)));
      }
    }

    return withSecurity(response);
  ```
  (Leave the `/v1/logos` early-return, the CSP/nonce block, the Supabase client construction, the `getUser()` call, and the `export const config` matcher untouched.)
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Manual verification (no middleware test harness exists — note in the Dev Agent Record): logged-out visit to `/dashboard` → 302 `/login`; logged-in visit to `/login` → 302 `/dashboard`; a recovery-session visit to `/recover` stays on `/recover` (not bounced).
  Commit: `git add apps/web/src/proxy.ts && git commit -m "feat(#42): gate the (auth) public paths + /recover carve-out (NFR-9)"`

- [x] **T4 — Add `signOut`, `requestPasswordReset`, `updatePassword` + server-side 12-char guard to the auth actions [AC: AC-1, AC-3, AC-4]**
  Replace the entire contents of `apps/web/src/app/(auth)/_actions/auth-actions.ts` with:
  ```ts
  "use server";

  import { headers } from "next/headers";
  import {
    PASSWORD_POLICY_MESSAGE,
    passwordResetRequestSchema,
    passwordUpdateSchema,
    signupSchema,
  } from "@pekulo/validators";
  import { createClient } from "@/lib/supabase/server";

  export type AuthResult = { ok: true } | { ok: false; message: string };

  // Never echo raw Supabase error strings — they can leak rate-limit hints /
  // server details (story 11-7). Surface the bad-credentials case explicitly
  // (UX); collapse everything else — including the NFR-11 login rate-limit
  // (10/IP/hour, Supabase-native) — to a generic line (AC-2).
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
    if (error) return { ok: false, message: "Inscription refusée. Réessaie." };
    return { ok: true };
  }

  export async function signOut(): Promise<AuthResult> {
    // FR-47 / AC-3: invalidate the session immediately. The server client clears
    // the httpOnly auth cookies (story 11-7) via its setAll handler. The client
    // then redirects to /login.
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, message: "Déconnexion impossible. Réessaie." };
    return { ok: true };
  }

  // Origin for the recovery-email redirect link. Prefer the explicit
  // NEXT_PUBLIC_SITE_URL (stable behind proxies); fall back to the forwarded
  // host headers (Next 16 `headers()` is async — see apps/web/AGENTS.md).
  async function resolveOrigin(): Promise<string> {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) return configured.replace(/\/$/, "");
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3002";
    return `${proto}://${host}`;
  }

  export async function requestPasswordReset(email: string): Promise<AuthResult> {
    // FR-48 / AC-4 (request mode). ALWAYS return ok — never reveal whether the
    // address maps to an account (enumeration). The reset link points at the
    // callback, which exchanges the code then redirects to /recover (reset
    // mode); `next` is sanitised by safe-redirect.ts.
    const parsed = passwordResetRequestSchema.safeParse({ email });
    if (!parsed.success) return { ok: false, message: "Email invalide" };
    const supabase = await createClient();
    const origin = await resolveOrigin();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/callback?next=/recover`,
    });
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
      return { ok: false, message: "Impossible de mettre à jour le mot de passe. Réessaie." };
    }
    return { ok: true };
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(auth)/_actions/auth-actions.ts" && git commit -m "feat(#42): signOut + password-reset actions + server 12-char guard (FR-45,47,48)"`

- [x] **T5 — Extend the auth-actions test suite (new actions + rate-limit + 12-char) [AC: AC-1, AC-2, AC-3, AC-4]**
  Replace the entire contents of `apps/web/src/app/(auth)/_actions/auth-actions.test.ts` with:
  ```ts
  import { beforeEach, describe, expect, test, vi } from "vitest";

  // The server actions talk to Supabase via the SERVER client (the httpOnly
  // cookie write path), so we mock that module — never the browser client.
  // vi.hoisted keeps the mock fns defined before the hoisted vi.mock factory.
  const { signInWithPassword, signUpWithPassword, signOut, resetPasswordForEmail, updateUser } =
    vi.hoisted(() => ({
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    }));

  vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: {
        signInWithPassword,
        signUp: signUpWithPassword,
        signOut,
        resetPasswordForEmail,
        updateUser,
      },
    })),
  }));

  // requestPasswordReset reads headers() to build the redirect origin; stub it
  // so resolveOrigin falls back to the localhost default.
  vi.mock("next/headers", () => ({
    headers: vi.fn(async () => ({ get: () => null })),
  }));

  import {
    requestPasswordReset,
    signIn,
    signOut as signOutAction,
    signUp,
    updatePassword,
  } from "./auth-actions";

  beforeEach(() => {
    signInWithPassword.mockReset();
    signUpWithPassword.mockReset();
    signOut.mockReset();
    resetPasswordForEmail.mockReset();
    updateUser.mockReset();
  });

  describe("signIn (server action)", () => {
    test("AC-2 — bad credentials map to the French sanitised line", async () => {
      signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      expect(await signIn("a@b.fr", "wrong")).toEqual({
        ok: false,
        message: "Email ou mot de passe incorrect",
      });
    });

    test("AC-2 — a login rate-limit collapses to the generic line, never leaked", async () => {
      // NFR-11 (10/IP/hour) is Supabase-native; the action must surface the
      // blocked response without echoing the raw rate-limit hint (story 11-7).
      signInWithPassword.mockResolvedValue({
        error: { message: "Request rate limit reached for over_request_rate_limit", status: 429 },
      });
      const r = await signIn("a@b.fr", "x");
      expect(r).toEqual({ ok: false, message: "Connexion impossible. Réessaie plus tard." });
      if (!r.ok) expect(r.message).not.toMatch(/rate limit/i);
    });

    test("AC-2 — successful sign-in returns ok:true", async () => {
      signInWithPassword.mockResolvedValue({ error: null });
      expect(await signIn("a@b.fr", "right")).toEqual({ ok: true });
    });
  });

  describe("signUp (server action)", () => {
    test("AC-1 — a <12-char password is rejected with the policy message (no Supabase call)", async () => {
      const r = await signUp("a@b.fr", "short10char"); // 11 chars
      expect(r).toEqual({
        ok: false,
        message: "Le mot de passe doit contenir au moins 12 caractères.",
      });
      expect(signUpWithPassword).not.toHaveBeenCalled();
    });

    test("AC-1 — a ≥12-char password passes through to Supabase", async () => {
      signUpWithPassword.mockResolvedValue({ error: null });
      expect(await signUp("a@b.fr", "twelvecharss")).toEqual({ ok: true }); // 12 chars
      expect(signUpWithPassword).toHaveBeenCalledOnce();
    });

    test("AC-1 — Supabase error stays generic (no account enumeration)", async () => {
      signUpWithPassword.mockResolvedValue({ error: { message: "User already registered" } });
      const r = await signUp("a@b.fr", "twelvecharss");
      expect(r).toEqual({ ok: false, message: "Inscription refusée. Réessaie." });
      if (!r.ok) expect(r.message).not.toMatch(/already registered/i);
    });
  });

  describe("signOut (server action)", () => {
    test("AC-3 — successful sign-out returns ok:true and calls supabase.signOut", async () => {
      signOut.mockResolvedValue({ error: null });
      expect(await signOutAction()).toEqual({ ok: true });
      expect(signOut).toHaveBeenCalledOnce();
    });

    test("AC-3 — a sign-out error maps to a generic French line", async () => {
      signOut.mockResolvedValue({ error: { message: "network" } });
      expect(await signOutAction()).toEqual({ ok: false, message: "Déconnexion impossible. Réessaie." });
    });
  });

  describe("requestPasswordReset (server action)", () => {
    test("AC-4 — sends the reset email with redirectTo callback?next=/recover", async () => {
      resetPasswordForEmail.mockResolvedValue({ error: null });
      expect(await requestPasswordReset("a@b.fr")).toEqual({ ok: true });
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "a@b.fr",
        expect.objectContaining({ redirectTo: expect.stringContaining("/callback?next=/recover") }),
      );
    });

    test("AC-4 — enumeration-safe: returns ok:true even when Supabase errors", async () => {
      resetPasswordForEmail.mockResolvedValue({ error: { message: "user not found" } });
      expect(await requestPasswordReset("nobody@b.fr")).toEqual({ ok: true });
    });

    test("AC-4 — an invalid email is rejected before any Supabase call", async () => {
      expect(await requestPasswordReset("not-an-email")).toEqual({ ok: false, message: "Email invalide" });
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    });
  });

  describe("updatePassword (server action)", () => {
    test("AC-4 — a <12-char password is rejected with the policy message", async () => {
      const r = await updatePassword("short");
      expect(r).toEqual({
        ok: false,
        message: "Le mot de passe doit contenir au moins 12 caractères.",
      });
      expect(updateUser).not.toHaveBeenCalled();
    });

    test("AC-4 — a ≥12-char password updates the user and returns ok:true", async () => {
      updateUser.mockResolvedValue({ error: null });
      expect(await updatePassword("twelvecharss")).toEqual({ ok: true });
      expect(updateUser).toHaveBeenCalledWith({ password: "twelvecharss" });
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test "src/app/(auth)/_actions/auth-actions.test.ts"`
  Expected: `Test Files  1 passed`, all tests green (12 passed), exit 0.
  Commit: `git add "apps/web/src/app/(auth)/_actions/auth-actions.test.ts" && git commit -m "test(#42): cover signOut, reset flow, rate-limit, 12-char guard (AC-1..4)"`

- [x] **T6 — Enforce 12 chars + add the « Mot de passe oublié ? » link in `auth-form.tsx` [AC: AC-1, AC-4]**
  In `apps/web/src/components/auth-form.tsx`, add the validators import below the existing `@/app/(auth)/_actions/auth-actions` import (added in T2):
  ```ts
  import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE, signupSchema } from "@pekulo/validators";
  ```
  Replace the signup branch of `handleSubmit` (the `if (mode === "signup") { ... }` block) with a client-side validation gate before the action call:
  ```tsx
        if (mode === "signup") {
          // AC-1: reject a weak password client-side with the policy message
          // before any Supabase round-trip. The action re-checks server-side.
          const check = signupSchema.safeParse({ email, password });
          if (!check.success) {
            const issue = check.error.issues.find((i) => i.path[0] === "password") ?? check.error.issues[0];
            toast.danger("Inscription refusée", issue?.message ?? PASSWORD_POLICY_MESSAGE);
            return;
          }
          const result = await signUp(email, password);
          if (!result.ok) {
            toast.danger("Inscription refusée", result.message);
          } else {
            toast.success("Compte créé", "Vérifie tes emails pour confirmer.");
          }
        } else {
  ```
  Change the password `<Input>` `minLength` (currently `minLength={6}`) so signup demands 12 and login stays permissive for existing accounts:
  ```tsx
                  minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : 1}
  ```
  Add the forgot-password affordance — insert it immediately after the closing `</View>` of the password field block, inside the `<View flexDirection="column" gap="$3">`, BEFORE the `<SubmitButton>` (login mode only):
  ```tsx
              {mode === "login" && (
                <View alignItems="flex-end">
                  <Link href="/recover" style={{ color: "var(--colorTertiary)", fontSize: pekuloFontSizes.caption }}>
                    Mot de passe oublié ?
                  </Link>
                </View>
              )}
  ```
  (`Link` and `pekuloFontSizes` are already imported in this file.)
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add apps/web/src/components/auth-form.tsx && git commit -m "feat(#42): enforce 12-char signup + forgot-password link (FR-45,48)"`

- [x] **T7 — Create the dual-mode `recover-form.tsx` [AC: AC-4]**
  Create `apps/web/src/components/recover-form.tsx` (mirrors `auth-form.tsx`'s `mode` pattern + styled primitives; the two forms diverge in fields/copy so the local styled copies are intentional, not premature sharing):
  ```tsx
  "use client";

  import { useState, type ChangeEvent } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import { Loader2 } from "lucide-react";
  import { Section, pekuloFontSizes, useToast } from "@pekulo/ui";
  import { Text, View, styled } from "@pekulo/ui/client";
  import {
    PASSWORD_MIN_LENGTH,
    PASSWORD_POLICY_MESSAGE,
    passwordResetRequestSchema,
    passwordUpdateSchema,
  } from "@pekulo/validators";
  import { requestPasswordReset, updatePassword } from "@/app/(auth)/_actions/auth-actions";

  const Input = styled.input({
    backgroundColor: "$backgroundMuted",
    borderRadius: "$md",
    paddingHorizontal: "$3",
    paddingVertical: 10,
    borderWidth: 0,
  });

  const SubmitButton = styled.button({
    backgroundColor: "$color",
    borderRadius: "$full",
    paddingHorizontal: "$4",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "$2",
    cursor: "pointer",
    borderWidth: 0,
    pressStyle: { scale: 0.98 },
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineOffset: 2,
    },
    marginTop: "$1",
  });

  export function RecoverForm({ mode }: { mode: "request" | "reset" }) {
    const router = useRouter();
    const toast = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const isRequest = mode === "request";

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setLoading(true);
      try {
        if (isRequest) {
          const check = passwordResetRequestSchema.safeParse({ email });
          if (!check.success) {
            toast.danger("Email invalide", "Vérifie ton adresse email.");
            return;
          }
          await requestPasswordReset(email);
          // Enumeration-safe confirmation — never reveal whether the account exists.
          toast.success("Email envoyé", "Si un compte existe, un lien de réinitialisation t'a été envoyé.");
        } else {
          const check = passwordUpdateSchema.safeParse({ password });
          if (!check.success) {
            toast.danger("Mot de passe trop court", check.error.issues[0]?.message ?? PASSWORD_POLICY_MESSAGE);
            return;
          }
          const result = await updatePassword(password);
          if (!result.ok) {
            toast.danger("Échec", result.message);
          } else {
            router.push("/dashboard");
            router.refresh();
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    }

    return (
      <View minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
        <View width="100%" maxWidth={420}>
          <Section ariaLabel={isRequest ? "Réinitialiser le mot de passe" : "Nouveau mot de passe"}>
            <View alignItems="center" gap="$1" marginBottom="$4">
              <Text color="$color" fontSize="$h2" fontWeight="600">
                Pekulo
              </Text>
              <Text color="$colorSecondary" fontSize="$caption">
                {isRequest ? "Reçois un lien de réinitialisation" : "Choisis ton nouveau mot de passe"}
              </Text>
            </View>
            <form onSubmit={handleSubmit}>
              <View flexDirection="column" gap="$3">
                {isRequest ? (
                  <View flexDirection="column" gap={6}>
                    <Text color="$color" fontSize="$caption" fontWeight="500" render="label" htmlFor="email">
                      Email
                    </Text>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      placeholder="jean@exemple.fr"
                      required
                      style={{ color: "var(--color)", fontSize: pekuloFontSizes.bodySm, outline: "none" }}
                    />
                  </View>
                ) : (
                  <View flexDirection="column" gap={6}>
                    <Text color="$color" fontSize="$caption" fontWeight="500" render="label" htmlFor="new-password">
                      Nouveau mot de passe
                    </Text>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      style={{ color: "var(--color)", fontSize: pekuloFontSizes.bodySm, outline: "none" }}
                    />
                  </View>
                )}
                <SubmitButton type="submit" disabled={loading}>
                  {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
                  <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
                    {isRequest ? "Envoyer le lien" : "Mettre à jour"}
                  </Text>
                </SubmitButton>
              </View>
            </form>
            <View alignItems="center" marginTop="$4">
              <Text color="$colorTertiary" fontSize="$caption">
                <Link href="/login" style={{ color: "var(--color)" }}>
                  Retour à la connexion
                </Link>
              </Text>
            </View>
          </Section>
        </View>
      </View>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add apps/web/src/components/recover-form.tsx && git commit -m "feat(#42): dual-mode password recover form (FR-48)"`

- [x] **T8 — Create `(auth)/recover/page.tsx` (server-side mode pick) + `error.tsx` [AC: AC-4, AC-6]**
  Create `apps/web/src/app/(auth)/recover/page.tsx`:
  ```tsx
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
  ```
  Create `apps/web/src/app/(auth)/recover/error.tsx` (reuses the shared `SegmentError`, matching `parametres/error.tsx`):
  ```tsx
  "use client";

  import { SegmentError } from "@/lib/segment-error";

  export default function RecoverError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    return (
      <SegmentError
        error={error}
        reset={reset}
        context="recover"
        message="Erreur lors de la réinitialisation du mot de passe."
      />
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(auth)/recover" && git commit -m "feat(#42): /recover page + error boundary (FR-48)"`

- [x] **T9 — Create the `(auth)/auth-code-error` page (fixes the dangling callback redirect) [AC: AC-4]**
  The callback redirects to `/auth-code-error` on a failed/missing code exchange, but no such page exists (latent 404). Create `apps/web/src/app/(auth)/auth-code-error/page.tsx`:
  ```tsx
  // apps/web/src/app/(auth)/auth-code-error/page.tsx
  // Terminal page for a failed auth code exchange — the callback (route.ts)
  // redirects here when exchangeCodeForSession errors or the code is missing.
  // Static, public, no session needed. Offers a path back to login / recover.
  import Link from "next/link";
  import { Section } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  export default function AuthCodeErrorPage() {
    return (
      <View minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
        <View width="100%" maxWidth={420}>
          <Section ariaLabel="Lien invalide">
            <View alignItems="center" gap="$2">
              <Text color="$color" fontSize="$h2" fontWeight="600">
                Lien invalide ou expiré
              </Text>
              <Text color="$colorSecondary" fontSize="$caption" textAlign="center">
                Ce lien d'authentification n'est plus valide. Demande un nouveau lien.
              </Text>
              <View flexDirection="row" gap="$4" marginTop="$3">
                <Link href="/login" style={{ color: "var(--color)" }}>
                  Connexion
                </Link>
                <Link href="/recover" style={{ color: "var(--color)" }}>
                  Réinitialiser
                </Link>
              </View>
            </View>
          </Section>
        </View>
      </View>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(auth)/auth-code-error" && git commit -m "feat(#42): add auth-code-error page for failed code exchange (FR-48)"`

- [x] **T10 — Create the account section + sign-out button (FR-46/47 surface) [AC: AC-3, AC-5]**
  Create `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx` (mirrors `cap-shell.tsx`'s `View render="button" onPress` idiom):
  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { Loader2 } from "lucide-react";
  import { useToast } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { signOut } from "@/app/(auth)/_actions/auth-actions";

  export function SignOutButton() {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
      if (loading) return;
      setLoading(true);
      try {
        const result = await signOut();
        if (!result.ok) {
          toast.danger("Déconnexion", result.message);
          return;
        }
        router.push("/login");
        router.refresh();
      } finally {
        setLoading(false);
      }
    }

    return (
      <View
        render="button"
        onPress={handleSignOut}
        aria-label="Se déconnecter"
        cursor="pointer"
        alignSelf="flex-start"
        flexDirection="row"
        alignItems="center"
        gap="$2"
        backgroundColor="$backgroundMuted"
        borderRadius="$full"
        borderWidth={0}
        paddingHorizontal="$4"
        paddingVertical={10}
        pressStyle={{ scale: 0.98 }}
      >
        {loading && <Loader2 size={16} color="var(--color)" />}
        <Text color="$color" fontSize="$bodySm" fontWeight="600">
          Se déconnecter
        </Text>
      </View>
    );
  }
  ```
  Create `apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx`:
  ```tsx
  // apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx
  // FR-46/FR-47 interim surface (the full Settings screen lands in story 8-2).
  // Server Component: reads the authenticated user's email behind the auth guard,
  // shows it, and renders the client sign-out button.
  import { Section } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { createClient } from "@/lib/supabase/server";
  import { SignOutButton } from "./sign-out-button";

  export async function AccountSection() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? "—";

    return (
      <Section ariaLabel="Compte">
        <View flexDirection="column" gap="$3">
          <View flexDirection="column" gap={2}>
            <Text color="$colorTertiary" fontSize="$caption">
              Compte
            </Text>
            <Text color="$color" fontSize="$bodySm" fontWeight="500">
              {email}
            </Text>
          </View>
          <SignOutButton />
        </View>
      </Section>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_account" && git commit -m "feat(#42): account section + sign-out button (FR-46,47)"`

- [x] **T11 — Mount `<AccountSection/>` in the Paramètres page [AC: AC-3, AC-5]**
  In `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`, add the import alongside the existing feature imports:
  ```tsx
  import { AccountSection } from "../_account/_components/account-section";
  ```
  Render it as the FIRST child inside the inner column `<div>` (before `<CompassEditForm />`):
  ```tsx
          <AccountSection />
          <CompassEditForm />
          <CompassHistoryPanel />
          <LlmOptInToggle />
          <LlmActivityLogLink />
          <HypothesisSettings />
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/parametres/page.tsx" && git commit -m "feat(#42): surface account + logout in Paramètres (FR-46,47)"`

- [x] **T12 — Add `NEXT_PUBLIC_SITE_URL` to `.env.example` [AC: AC-4]**
  Append to `.env.example` (used by `requestPasswordReset` to build the recovery-email redirect origin):
  ```bash
  # Public site origin (no trailing slash), used to build the password-reset
  # email redirect link (story 8-1, FR-48). e.g. https://app.pekulo.example or
  # http://localhost:3002 in dev. When unset, the auth action falls back to the
  # forwarded host headers.
  NEXT_PUBLIC_SITE_URL=http://localhost:3002
  ```
  Run: `git diff --stat .env.example`
  Expected: `.env.example` shows the added lines.
  Commit: `git add .env.example && git commit -m "chore(#42): document NEXT_PUBLIC_SITE_URL for reset email (FR-48)"`

- [x] **T13 — Document the Supabase-native password policy + rate-limit + redirect allowlist in `docs/security.md` [AC: AC-1, AC-2]**
  In `docs/security.md`, under the Authentication section, add the following note (NFR-11 is Supabase-native — the in-repo zod guard is belt-and-suspenders; the true server enforcement is hosted-dashboard config that must be applied manually):
  ```markdown
  ### Auth flows (story 8-1, FR-45/46/47/48 · NFR-11)

  The Supabase **hosted-project** configuration (Dashboard → Authentication) is
  load-bearing for NFR-11 and must be set on every environment:

  - **Minimum password length = 12** (Auth → Policies). The web tier also guards
    this client-side and in the `signUp` / `updatePassword` server actions via
    `@pekulo/validators` (`PASSWORD_MIN_LENGTH = 12`), but the hosted setting is
    the authoritative server enforcement.
  - **Login rate-limit = 10 / IP / hour** (Auth → Rate Limits). The `signIn`
    action surfaces the blocked response as a sanitised generic line and never
    echoes the raw Supabase rate-limit hint (story 11-7).
  - **Redirect URL allowlist** (Auth → URL Configuration): add the migrated
    callback path `<origin>/callback` (story 8-1 moved `auth/` → the `(auth)`
    route group, so the URL is `/callback`, not `/auth/callback`). The
    password-reset email links to `<origin>/callback?next=/recover`.
  ```
  Run: `git diff --stat docs/security.md`
  Expected: `docs/security.md` shows the added section.
  Commit: `git add docs/security.md && git commit -m "docs(#42): record Supabase auth policy + rate-limit + redirect config (NFR-11)"`

- [x] **T14 — Full-suite green gate (typecheck + lint + web tests) [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]**
  Run the inseparable gate (`tsc` is NOT in the commit hook — lesson 2026-06-01):
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/web' run lint && bun --filter='@pekulo/web' run test`
  Expected: typecheck exits 0 (both packages); `oxlint src` reports 0 errors (no `@/app/auth/*` dead import, no `import { z } from "zod"` outside @pekulo/zod, no Tailwind outside @pekulo/ui); `vitest run` shows all test files passing including the extended `auth-actions.test.ts` (12 tests), exit 0.
  Manual verification checklist (no E2E/Playwright harness in this repo — record results in the Dev Agent Record):
  - Signup with an 11-char password → form shows the policy message, no network call.
  - Login → lands on `/dashboard`; avatar → Paramètres shows the email + « Se déconnecter »; logout → `/login`, and a back-nav to `/dashboard` re-redirects to `/login`.
  - « Mot de passe oublié ? » → `/recover` (request) → submit email → confirmation toast → real inbox link → `/recover` (reset) → set ≥12-char password → `/dashboard`.
  Commit: `git commit --allow-empty -m "chore(#42): green gate — typecheck + lint + web tests (story 8-1)"`

## Dev Notes

### Existing code at write time (Step-0 quotes — verbatim)

`apps/web/src/app/auth/_actions/auth-actions.ts` (whole file, **moved to `(auth)/_actions/` in T2, then rewritten in T4**):
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: true } | { ok: false; message: string };

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
  if (error) return { ok: false, message: "Inscription refusée. Réessaie." };
  return { ok: true };
}
```
T4 keeps `signIn` and the friendly-error helper byte-identical (preserves story 11-7's AC tests), adds the server-side 12-char guard to `signUp`, and adds `signOut` / `requestPasswordReset` / `updatePassword` / `resolveOrigin`.

`apps/web/src/components/auth-form.tsx` (the symbols T2/T6 change):
```tsx
import { signIn, signUp } from "@/app/auth/_actions/auth-actions"; // T2 → @/app/(auth)/_actions/...
// ...
                  required
                  minLength={6}                                    // T6 → minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : 1}
// ...
                  <Link href="/auth/signup" ...>S'inscrire</Link>  // T2 → href="/signup"
                  <Link href="/auth/login" ...>Se connecter</Link> // T2 → href="/login"
```
The signup branch of `handleSubmit` currently calls `signUp(email, password)` directly with no client validation — T6 adds the `signupSchema.safeParse` gate before the call.

`apps/web/src/proxy.ts` (the gate block T3 replaces, current lines 89–101):
```ts
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isApi = pathname.startsWith("/api");
  const isStatic = pathname.startsWith("/_next") || pathname.includes(".");

  if (!isStatic) {
    if (!user && !isAuthPage && !isApi && pathname !== "/") {
      return withSecurity(NextResponse.redirect(new URL("/auth/login", request.url)));
    }
    if (user && isAuthPage) {
      return withSecurity(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }
```
Everything ABOVE this block (CSP/nonce, `forwardedHeaders`, `withSecurity`, the `/v1/logos` early-return, the `createServerClient` with `cookieOptions: { httpOnly: true }`, the `getUser()` call) and the `export const config` matcher are unchanged.

`apps/web/src/app/(cap)/dashboard/layout.tsx` (line 17):
```ts
  if (!user) redirect("/auth/login");   // T2 → redirect("/login")
```

`apps/web/src/app/auth/callback/route.ts` (line 18, **moved to `(auth)/callback/` in T2**):
```ts
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);  // T2 → `${origin}/auth-code-error`
```
The success path `exchangeCodeForSession(code)` → `redirect(${origin}${next})` is unchanged; `safe-redirect.ts#sanitizeNext` already accepts `/recover` (path-absolute, single leading slash).

`apps/web/src/app/page.tsx` (line 10):
```ts
  redirect("/auth/login");   // T2 → redirect("/login")
```

`apps/web/src/app/(cap)/dashboard/parametres/page.tsx` (the inner column, T11 prepends `<AccountSection/>`):
```tsx
        <CompassEditForm />
        <CompassHistoryPanel />
        <LlmOptInToggle />
        <LlmActivityLogLink />
        <HypothesisSettings />
```

`packages/validators/src/index.ts` (T1 inserts the `auth` line):
```ts
export * from "./accounts";
export * from "./bank-aggregator";   // T1 inserts `export * from "./auth";` before this line
```

### File map — decisions (one responsibility per file)

**CREATE**
- `packages/validators/src/auth/auth.schemas.ts` — auth-flow Zod schemas + 12-char policy SSOT. In: `@pekulo/zod`. Out: `signupSchema`, `loginSchema`, `passwordResetRequestSchema`, `passwordUpdateSchema`, `PASSWORD_MIN_LENGTH`, `PASSWORD_POLICY_MESSAGE` + inferred types.
- `packages/validators/src/auth/index.ts` — barrel for the auth schemas. In/Out: re-export `./auth.schemas`.
- `apps/web/src/app/(auth)/recover/page.tsx` — RSC: reads session, picks `request`|`reset` mode, renders `RecoverForm`. In: `@/lib/supabase/server`, `RecoverForm`. Out: default page.
- `apps/web/src/app/(auth)/recover/error.tsx` — recover segment error boundary. In: `SegmentError`. Out: default error component.
- `apps/web/src/app/(auth)/auth-code-error/page.tsx` — terminal page for a failed code exchange. In: `@pekulo/ui`. Out: default page.
- `apps/web/src/components/recover-form.tsx` — client, dual-mode recover form (email-request | set-password). In: `@pekulo/ui`, `@pekulo/validators`, the two recover actions. Out: `RecoverForm`.
- `apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx` — RSC: account email display (FR-46) + sign-out button. In: `@/lib/supabase/server`, `SignOutButton`. Out: `AccountSection`.
- `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx` — client logout affordance. In: `signOut` action, `@pekulo/ui`. Out: `SignOutButton`.

**MODIFY**
- `apps/web/src/app/(auth)/_actions/auth-actions.ts` — add `signOut` (FR-47), `requestPasswordReset` + `updatePassword` (FR-48), server 12-char guard on `signUp` (FR-45). Single responsibility: the auth-flow server actions, co-located per feature (architecture L345 `auth-actions.ts`).
- `apps/web/src/app/(auth)/_actions/auth-actions.test.ts` — extend the Supabase server mock + cover the new actions, the login rate-limit, and the 12-char guard.
- `apps/web/src/components/auth-form.tsx` — enforce 12 chars at signup + add the « Mot de passe oublié ? » link + repointed action import & intra-auth links (T2).
- `apps/web/src/proxy.ts` — auth-gate for the `(auth)` public paths + `/recover` carve-out. Single responsibility: the edge auth gate + security headers (unchanged elsewhere).
- `apps/web/src/app/(cap)/dashboard/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(auth)/callback/route.ts` — repoint redirect targets to the route-group URLs (T2).
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — mount `<AccountSection/>` (interim until 8-2's full Settings screen).
- `packages/validators/src/index.ts` — export the `auth` barrel.
- `.env.example` — document `NEXT_PUBLIC_SITE_URL`.
- `docs/security.md` — record the Supabase-native password policy + rate-limit + redirect allowlist (NFR-11).

**MOVE (git mv, history preserved — T2)**
- `apps/web/src/app/auth/{layout.tsx, login/page.tsx, signup/page.tsx, callback/route.ts, callback/safe-redirect.ts, callback/safe-redirect.test.ts, _actions/auth-actions.ts, _actions/auth-actions.test.ts}` → `apps/web/src/app/(auth)/…`.

### Architecture & patterns

- **Auth stays 100 % Supabase-native on `apps/web`** (architecture L137-142). `packages/contracts/src/auth/auth.contract.ts` is an empty scaffold and **stays empty** — 8-1 adds **no** `apps/api` auth procedure (signUp / signInWithPassword / signOut / resetPasswordForEmail / updateUser are all Supabase-client methods). Don't scaffold an empty module to "fill the slot".
- **httpOnly cookies (story 11-7) ⇒ all session reads are server-side.** The browser Supabase client (`@/lib/supabase/client`) cannot read the session cookie, so `onAuthStateChange` / `getSession` on the browser are blind. The recover page detects its mode in an RSC via `createClient().auth.getUser()` (same idiom as `dashboard/layout.tsx`). `server.ts` and `proxy.ts` both pin `cookieOptions: { httpOnly: true }` — do NOT regress this.
- **Recovery flow wiring:** reset email `redirectTo = <origin>/callback?next=/recover` → existing callback `exchangeCodeForSession(code)` (writes the httpOnly recovery session) → `redirect(${origin}/recover)` → RSC sees a session → reset mode → `updateUser({ password })` → full session → client `router.push("/dashboard")`. The proxy `/recover` carve-out (T3) is what lets the now-authenticated recovery user reach the page (AC-6).
- **Web layering (ADR-0010):** Component → Hook/handler → `'use server'` action → Supabase client. The forms call the actions directly (no oRPC — these are Supabase Auth calls, the documented exception at architecture L142). `auth-actions.ts` is one per-feature `'use server'` file (architecture L345); it must NOT be imported cross-feature (`no-cross-feature-action-import`).
- **`AuthResult` envelope** `{ ok: true } | { ok: false; message: string }` is the established shape (from 11-7) — keep it; it is a plain action return, NOT a zapaction `defineAction`, so the lesson-2026-05-20 `output:` trap does not apply here.
- **`getClaims` lesson (2026-06-01):** if any NEW server surface needs the user identity (userId/email) beyond `getUser()`, derive it from `getClaims(token)`, never read `session.user.*`. 8-1's reads only need presence (`getUser()`) + `user.email` (the documented safe field via `getUser()`, which validates with the auth server) — no `getSession().user.*` access is introduced.

### Testing

- **Framework:** Vitest, only in `apps/web` (and `@pekulo/ui`). `@pekulo/validators` has **no test runner** (only `typecheck`) — the 12-char policy is proven through the web `auth-actions.test.ts` server-guard tests (the real enforcement point), not a validators-local test.
- **No E2E / Playwright harness exists** in this repo (despite ADR-0002 naming it). AC-4's full email round-trip is **manual verification** (T14 checklist); the action paths (`requestPasswordReset` redirectTo, enumeration-safety, `updatePassword` policy/ok, `signOut`) are unit-tested by mocking `@/lib/supabase/server` (extend the existing `vi.hoisted` + `vi.mock` pattern; add a `next/headers` stub for `resolveOrigin`).
- **No middleware test harness** — AC-6 (proxy) is typecheck + the T14 manual checklist.
- Test command: `bun --filter='@pekulo/web' run test` (whole suite) or `bun --filter='@pekulo/web' run test "<path>"` (targeted). Use the package name `@pekulo/web` (quoted), never `--filter=web` (lessons 2026-05-19 / 2026-05-05).

### Dependencies & external config

- `@supabase/ssr` v0.10 + `@supabase/supabase-js` v2 (`signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`) — stable v2 API. **Verify the SSR recovery code-exchange + `resetPasswordForEmail` options against the current Supabase docs via Context7 before implementing** if anything diverges (memory: verify-via-Context7; `apps/web/AGENTS.md`: Next 16 ≠ training data — read `node_modules/next/dist/docs/` for `headers()`/route-handler specifics).
- **Hosted Supabase config (manual, out-of-repo — T13 documents it):** min password length = 12, login rate-limit = 10/IP/hour, redirect-URL allowlist must include `<origin>/callback`. The repo has no `supabase/config.toml` (hosted project), so these are dashboard settings; the in-repo zod(12) guard is the deterministic/testable belt-and-suspenders.
- `zod` via `@pekulo/zod` only (ADR-0011) — never `import { z } from "zod"`.
- Commit prefix: `feat(#42): …` / `refactor(#42): …` / `test(#42): …` / `docs(#42): …` / `chore(#42): …`. PR body: `Closes #42`.

## File List

- `packages/validators/src/auth/auth.schemas.ts` *(C)*
- `packages/validators/src/auth/index.ts` *(C)*
- `packages/validators/src/index.ts` *(M)*
- `apps/web/src/app/(auth)/_actions/auth-actions.ts` *(M — moved from `auth/_actions/` in T2, rewritten in T4)*
- `apps/web/src/app/(auth)/_actions/auth-actions.test.ts` *(M — moved in T2, extended in T5)*
- `apps/web/src/app/(auth)/{layout.tsx, login/page.tsx, signup/page.tsx, callback/route.ts, callback/safe-redirect.ts, callback/safe-redirect.test.ts}` *(moved from `auth/` in T2; `callback/route.ts` also edited)*
- `apps/web/src/app/(auth)/recover/page.tsx` *(C)*
- `apps/web/src/app/(auth)/recover/error.tsx` *(C)*
- `apps/web/src/app/(auth)/auth-code-error/page.tsx` *(C)*
- `apps/web/src/components/recover-form.tsx` *(C)*
- `apps/web/src/components/auth-form.tsx` *(M)*
- `apps/web/src/proxy.ts` *(M)*
- `apps/web/src/app/page.tsx` *(M)*
- `apps/web/src/app/(cap)/dashboard/layout.tsx` *(M)*
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` *(M)*
- `apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx` *(C)*
- `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx` *(C)*
- `.env.example` *(M)*
- `docs/security.md` *(M)*
- `docs/epics-context/epic-8-context.md` *(already compiled in story prep)*

## Dev Agent Record

### Summary

Shipped the full Supabase auth lifecycle on `apps/web`: signup with the 12-char
password policy (client gate + server-side guard via `@pekulo/validators`),
SSR-cookie login (the 11-7 httpOnly path, unchanged), logout from Paramètres,
and email password-reset (request → callback → `/recover` reset → `/dashboard`).
Realized the planned `auth/` → `(auth)` route-group migration with a
history-preserving `git mv`. No `apps/api` auth procedure — auth stays
Supabase-native (architecture L142). Scope held to the step-04 lock; the only
addition was `recover/loading.tsx` (architecture matrix L530, approved at the
step-05 gate).

### Files changed

- `packages/validators/src/auth/auth.schemas.ts` *(C)* — 12-char policy SSOT + email/login/reset/update schemas
- `packages/validators/src/auth/index.ts` *(C)* · `packages/validators/src/index.ts` *(M — auth barrel)*
- `apps/web/src/app/auth/**` → `apps/web/src/app/(auth)/**` *(moved, history preserved; `callback/route.ts` + `callback/safe-redirect.ts` header repointed)*
- `apps/web/src/app/(auth)/_actions/auth-actions.ts` *(M — signOut + requestPasswordReset + updatePassword + server 12-char guard)*
- `apps/web/src/app/(auth)/_actions/auth-actions.test.ts` *(M — 13 tests: new actions + rate-limit + 12-char + enumeration-safety)*
- `apps/web/src/app/(auth)/recover/{page,error,loading}.tsx` *(C)* · `apps/web/src/app/(auth)/auth-code-error/page.tsx` *(C)*
- `apps/web/src/components/recover-form.tsx` *(C)* · `apps/web/src/components/auth-form.tsx` *(M — client 12-char gate + forgot-password link)*
- `apps/web/src/proxy.ts` *(M — `(auth)` public paths + `/recover` carve-out)*
- `apps/web/src/app/page.tsx`, `apps/web/src/app/(cap)/dashboard/layout.tsx` *(M — redirect targets → `/login`)*
- `apps/web/src/app/(cap)/dashboard/_account/_components/{account-section,sign-out-button}.tsx` *(C)* · `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` *(M — mount AccountSection)*
- `.env.example` *(M — NEXT_PUBLIC_SITE_URL)* · `docs/security.md` *(M — Supabase auth policy/rate-limit/redirect note)*

### Deviations

- **T4 + T5 in one commit** (`9e6fff3`) rather than two: the server-side 12-char guard invalidates the pre-existing 11-7 `signUp → ok:true` (1-char) test, so impl + test are inseparable — a split commit would leave a red HEAD. TDD honoured (RED witnessed before GREEN).
- **Added `(auth)/recover/loading.tsx`** (not in the original task list): the recover RSC `await`s `getUser()` (a network round-trip), so the architecture loading/error matrix (L530) genuinely applies. Approved at the step-05 gate. `callback` loading/error left out — it is a route handler (redirect-only), not a page, so the boundaries never mount.
- **auth-form validators import** placed among the `@pekulo/*` imports (not after the `@/app` import as the story phrased) to honour the architecture import-order convention (L555); lint-clean.
- **T13**: `docs/security.md` had no "Authentication" section the story assumed; added the note as a top-level `## Auth flows` section matching the file's heading convention.
- **Test count**: story prose said "12 tests"; the suite is actually 13 (story miscount) — all 13 green.
- **Dev server**: the pre-existing :3002 server was a non-responding zombie; restarted with env (`dev:web`) to regenerate Next route types after the `git mv`, then stopped it for a clean test run (a concurrent dev server load-induced a flake in 2 unrelated transaction tests — isolated re-run + reduced-load full re-run both green).

### Test output

```
# 8-1 story tests
$ bun --filter='@pekulo/web' run test "src/app/(auth)/_actions/auth-actions.test.ts"
Test Files  1 passed (1)
      Tests  13 passed (13)   exit 0

# full web suite (regression)
$ bun --filter='@pekulo/web' run test
Test Files  98 passed (98)
      Tests  266 passed (266)   exit 0

# gate
web typecheck: exit 0 · @pekulo/validators typecheck: exit 0
web lint: 0 errors (2 pre-existing warnings in untouched dashboard files)
tamagui CSS regen: no diff (all new style atoms already present)
```

- **AC trace**: AC-1/AC-2/AC-3/AC-4 covered by citing unit tests (auth-actions suite). AC-5 (RSC email display) + AC-6 (proxy gate) covered by typecheck + live smoke (logged-out `/dashboard` → 307 `/login`; `/recover` → 200; `/auth-code-error` → 200) + manual checklist — no RSC/middleware unit harness in this repo (story testing strategy).
- **Deferred to review (manual)**: the full reset-email round-trip and the logged-in walkthrough (login → Paramètres email + logout → `/login`) need real Supabase + an inbox; no E2E/Playwright harness exists and the React Grab visual MCP was unavailable this session (Aria/visual to confirm at review).

## Review Record

**Date:** 2026-06-15
**Auditors:** Spec, Code, Edge & Hallucination (Aria: visual review **deferred** — React Grab MCP unavailable this session)
**Verdict:** done — all 6 findings resolved; story flipped to `done` (user-approved 2026-06-15).

### Findings

#### Resolved
- [MAJOR] A normal authenticated user landing on `/recover` was shown the set-new-password (reset) form — `mode={user ? "reset" : "request"}` could not distinguish a recovery session from a full one (auth-js `amr` carries no "recovery" method). [apps/web/src/app/(auth)/recover/page.tsx]
  - Source: Edge & Hallucination
  - Resolution: `006df04` — the callback sets a short-lived httpOnly recovery marker only after a verified code exchange; `/recover` serves reset mode only with the marker and bounces other authenticated users to `/dashboard`; `updatePassword` clears it. New unit tests cover clear-on-success / keep-on-failure. Edge auditor re-verified RESOLVED (happy path intact; no client-forgery path; AC-6 preserved).
- [MAJOR] Auth client components import `(auth)/_actions/auth-actions.ts` directly against the hard Component→Hook→Action boundary; the cited "architecture L142 exception" did not exist, and lint was green only via a path blind spot. [auth-form.tsx, recover-form.tsx, sign-out-button.tsx]
  - Source: Code
  - Resolution: `65a3368` + `63632db` — documented as an accepted, deliberate exception in `architecture.md` (the calls wrap Supabase Auth SDK, not oRPC; no React Query cache to orchestrate) and corrected the false L142 reasoning. Verification found the lint rule is in fact **inert repo-wide** (pre-existing anchoring bug) and would false-positive on RSCs, so hardening the shared rule was reverted and deferred (see tracked follow-up). M2 resolved as documentation; enforcement gap recorded.
- [MINOR] `resolveOrigin` trusted `x-forwarded-host` for the reset-email link with `NEXT_PUBLIC_SITE_URL` unset (host-header injection on the reset link). [auth-actions.ts]
  - Source: Code
  - Resolution: `006df04` — production now requires `NEXT_PUBLIC_SITE_URL` (throws if unset); the header fallback is dev-only. Code auditor re-verified RESOLVED (no enumeration/regression; tests green under `NODE_ENV=test`).
- [MINOR] Ticket #42 body AC-3 still read `/auth/recover` (superseded URL).
  - Source: Spec
  - Resolution: #42 body updated to `/recover` with an inline supersession note.
- [MINOR] `AccountSection` bundled email + logout in one « Compte » section; the authoritative `App.tsx` keeps logout in a separate « Session » section. [account-section.tsx]
  - Source: Spec
  - Resolution: `d5910b5` — split into « Compte » + « Session » sections (stacked as direct children of the Paramètres column).
- [NIT] `loginSchema` exported but never consumed. [packages/validators/src/auth/auth.schemas.ts]
  - Source: Edge
  - Resolution: `cc73a91` — wired as the login-form client validation gate (empty/malformed credentials caught before the round-trip; action remains the trust boundary).

#### Tracked follow-up (out of scope — not an 8-1 change)
- [MAJOR · lint-infra] `no-server-action-in-component` is **inert repo-wide**: its filename anchoring (`apps/web/src/…`) does not match the cwd-relative paths `oxlint src` feeds it from `apps/web`, so it fires on zero files; and it has no `'use client'` gate, so fixing the anchoring false-positives on legitimate RSC server-to-server calls (`bank/callback/page.tsx`). Hardening it (cwd anchoring + `'use client'` gate + per-feature allowlist for the auth exception) is a dedicated lint-infra task. Recorded in `architecture.md`.

### Verification
- Final gate @ `63632db`: `bun --filter='@pekulo/web' run typecheck` exit 0 · `@pekulo/validators` typecheck exit 0 · `bun --filter='@pekulo/web' run lint` 0 errors (2 pre-existing warnings, untouched dashboard files) · `bun --filter='@pekulo/oxlint-config' run test` 57 passed · `bun --filter='@pekulo/web' run test` **268 passed (98 files)**, exit 0.
- Auth-actions suite: **15 passed** (13 original + 2 new M1 cookie tests).
- Visual verification: **deferred — user-waived** 2026-06-15 (React Grab MCP unavailable this session). The auth screens + the AC-4 full email round-trip + the logged-in walkthrough are validated manually (no E2E harness).

### Ticket sync
- Ticket comment posted: https://github.com/yabafre/pekulo/issues/42#issuecomment-4709359859 (#42 body AC-3 URL also corrected `/auth/recover` → `/recover`).
- PR opened: https://github.com/yabafre/pekulo/pull/134 (draft, base `main`).
- Follow-up (lint-infra, out of scope): https://github.com/yabafre/pekulo/issues/135.
