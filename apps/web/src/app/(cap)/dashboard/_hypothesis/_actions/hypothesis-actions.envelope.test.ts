// AC-7 (story 7-3) — runtime coverage for the recordHypothesisProjection
// envelope, the half that was compile-verified only at dev time. The write
// MUST return `{ ok:true, projection }` on success and `{ ok:false, code,
// message }` on a thrown oRPC error (so the typed error code survives Next's
// prod Error sanitisation, lesson 2026-05-20 [BLOCKER]). The read mirrors
// getDashboardOverview — no envelope, direct return.
//
// The vitest config aliases @zapaction/core to a stub whose `defineAction`
// returns `(input) => spec.handler({ input })`, so calling the action invokes
// the handler directly. We mock only its two collaborators (the oRPC client +
// request-context) and neutralise the server-only context side-effect import.

import { beforeEach, describe, expect, test, vi } from "vitest";

const { recordProjection, getProjection } = vi.hoisted(() => ({
  recordProjection: vi.fn(),
  getProjection: vi.fn(),
}));

vi.mock("@/lib/orpc/modules", () => ({
  hypothesisClient: { recordProjection, getProjection },
}));
vi.mock("@/lib/orpc/request-context", () => ({
  ensureRequestContext: vi.fn(async () => ({
    accessToken: "t",
    userId: "user-uuid",
    email: null,
  })),
  seedRequestContext: vi.fn(),
}));
// Side-effect import in the action registers a Supabase-backed context factory
// (server-only). Neutralise it — the stubbed defineAction never resolves ctx.
vi.mock("@/lib/zapaction/context", () => ({}));

import { recordHypothesisProjection, getHypothesisProjection } from "./hypothesis-actions";

const validInput = {
  objectif: 800_000,
  horizonYears: 30,
  monthlyContribution: 1_000,
  perfEtfAnnuelle: 0.05,
};

beforeEach(() => {
  recordProjection.mockReset();
  getProjection.mockReset();
});

describe("recordHypothesisProjection (server action) — AC-7 envelope", () => {
  test("success wraps the projection in an { ok: true } envelope", async () => {
    recordProjection.mockResolvedValue(validInput);
    const r = await recordHypothesisProjection(validInput);
    expect(r).toEqual({ ok: true, projection: validInput });
  });

  test("a thrown typed oRPC error maps to { ok:false, code } — the code survives", async () => {
    recordProjection.mockRejectedValue(
      Object.assign(new Error("annualRate must be a finite number in [0, 1]"), {
        code: "HYPOTHESIS_INVALID_INPUT",
      }),
    );
    const r = await recordHypothesisProjection(validInput);
    expect(r).toEqual({
      ok: false,
      code: "HYPOTHESIS_INVALID_INPUT",
      message: "annualRate must be a finite number in [0, 1]",
    });
  });

  test("an error with no code falls back to INTERNAL", async () => {
    recordProjection.mockRejectedValue(new Error("network down"));
    const r = await recordHypothesisProjection(validInput);
    expect(r).toEqual({ ok: false, code: "INTERNAL", message: "network down" });
  });
});

describe("getHypothesisProjection (server action) — read mirror", () => {
  test("returns the curve directly with no envelope", async () => {
    const curve = {
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 30,
      points: [{ year: 0, eur: 60_000 }],
      finalEur: 1_100_323.294_201_847,
    };
    getProjection.mockResolvedValue(curve);
    const out = await getHypothesisProjection({ currentWealthEur: 60_000 });
    expect(out).toBe(curve);
    expect(getProjection).toHaveBeenCalledWith({ currentWealthEur: 60_000 });
  });
});
