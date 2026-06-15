import { beforeEach, describe, expect, test, vi } from "vitest";

// The server action talks to Supabase via the SERVER client (the httpOnly
// cookie write path), so we mock that module — never the browser client
// (AC-1: the browser no longer establishes the session). vi.hoisted keeps the
// mock fns defined before the hoisted vi.mock factory runs.
const { signInWithPassword, signUpWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signUp: signUpWithPassword },
  })),
}));

import { signIn, signUp } from "./auth-actions";

beforeEach(() => {
  signInWithPassword.mockReset();
  signUpWithPassword.mockReset();
});

describe("signIn (server action)", () => {
  // AC-2 (verbatim from story 11-7-auth-hardening-httponly-csp:30):
  //   error messages stay sanitised (French copy, no raw Supabase strings —
  //   "Email ou mot de passe incorrect" for bad creds, a generic line
  //   otherwise) ...
  test("AC-2 — bad credentials map to the French sanitised line", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await signIn("a@b.fr", "wrong")).toEqual({
      ok: false,
      message: "Email ou mot de passe incorrect",
    });
  });

  test("AC-2 — any other Supabase error collapses to a generic line, never echoed", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Request rate limit reached for over_email_send_rate_limit" },
    });
    const r = await signIn("a@b.fr", "x");
    expect(r).toEqual({ ok: false, message: "Connexion impossible. Réessaie plus tard." });
    // the raw Supabase string (a rate-limit hint) must not leak through
    if (!r.ok) expect(r.message).not.toMatch(/rate limit/i);
  });

  // AC-2: "both work end-to-end via the server-action path ... a successful
  // sign-in redirects to /dashboard" — the action returns ok:true and the
  // client performs the redirect so the toasts stay client-side.
  test("AC-2 — successful sign-in returns ok:true", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    expect(await signIn("a@b.fr", "right")).toEqual({ ok: true });
  });
});

describe("signUp (server action)", () => {
  // AC-2: sign-up "works end-to-end via the server-action path"; the error
  // copy stays generic so it never reveals whether the email already exists.
  test("AC-2 — sign-up error stays generic (no account enumeration)", async () => {
    signUpWithPassword.mockResolvedValue({ error: { message: "User already registered" } });
    const r = await signUp("a@b.fr", "x");
    expect(r).toEqual({ ok: false, message: "Inscription refusée. Réessaie." });
    if (!r.ok) expect(r.message).not.toMatch(/already registered/i);
  });

  test("AC-2 — successful sign-up returns ok:true", async () => {
    signUpWithPassword.mockResolvedValue({ error: null });
    expect(await signUp("a@b.fr", "x")).toEqual({ ok: true });
  });
});
