import { beforeEach, describe, expect, test, vi } from "vitest";

// The server actions talk to Supabase via the SERVER client (the httpOnly
// cookie write path), so we mock that module — never the browser client.
// vi.hoisted keeps the mock fns defined before the hoisted vi.mock factory.
const {
  signInWithPassword,
  signUpWithPassword,
  signOut,
  resetPasswordForEmail,
  updateUser,
  cookieDelete,
} = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  cookieDelete: vi.fn(),
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
// so resolveOrigin falls back to the localhost default. updatePassword also
// clears the recovery-marker cookie on success, so stub cookies() too.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
  cookies: vi.fn(async () => ({ delete: cookieDelete, get: vi.fn(), set: vi.fn() })),
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
  cookieDelete.mockReset();
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
    expect(await signOutAction()).toEqual({
      ok: false,
      message: "Déconnexion impossible. Réessaie.",
    });
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
    expect(await requestPasswordReset("not-an-email")).toEqual({
      ok: false,
      message: "Email invalide",
    });
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

  test("M1 — a successful reset clears the recovery marker cookie", async () => {
    updateUser.mockResolvedValue({ error: null });
    await updatePassword("twelvecharss");
    expect(cookieDelete).toHaveBeenCalledWith("pekulo-pwd-recovery");
  });

  test("M1 — a failed reset leaves the recovery marker intact", async () => {
    updateUser.mockResolvedValue({ error: { message: "weak" } });
    await updatePassword("twelvecharss");
    expect(cookieDelete).not.toHaveBeenCalled();
  });
});
