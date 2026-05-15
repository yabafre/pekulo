import { describe, expect, mock, test } from "bun:test";
import type {
  Compass,
  MilestonePresenceProbe,
  WealthHistoryProvider,
  WealthSnapshot,
} from "@pekulo/types";
import { createCompassService } from "./compass.service";
import type { CompassRepository } from "./compass.repository";
import { CompassError } from "./compass.errors";

function fakeRepo(behaviour: {
  findResult?: Compass | null;
  upsertResult?: Compass;
  findStartResult?: Date | null;
}): {
  repo: CompassRepository;
  mocks: {
    find: ReturnType<typeof mock>;
    upsert: ReturnType<typeof mock>;
    list: ReturnType<typeof mock>;
    findStart: ReturnType<typeof mock>;
  };
} {
  const find = mock(async (_userId: string) => behaviour.findResult ?? null);
  const upsert = mock(
    async (_userId: string, input: { objectif: number; horizonYears: number }) =>
      behaviour.upsertResult ?? input,
  );
  const list = mock(async (_userId: string) => []);
  const findStart = mock(async (_userId: string) => behaviour.findStartResult ?? null);
  return {
    repo: {
      findCompass: find as CompassRepository["findCompass"],
      upsertCompassWithHistory: upsert as CompassRepository["upsertCompassWithHistory"],
      listHistory: list as CompassRepository["listHistory"],
      findCompassStartDate: findStart as CompassRepository["findCompassStartDate"],
    },
    mocks: { find, upsert, list, findStart },
  };
}

function probe(value: boolean): MilestonePresenceProbe {
  return { hasAny: async () => value };
}

function fakeWealth(snapshots: WealthSnapshot[]): WealthHistoryProvider {
  return { read: async () => snapshots };
}

function fixedClock(at: string): () => Date {
  return () => new Date(at);
}

describe("compass.service", () => {
  // AC-1 (verbatim from story 1-1 L16): updateCompass({ objectif: 800_000,
  // horizonYears: 25 }) upserts Hypothesis + inserts CompassHistory in one
  // $transaction. Service-level the $transaction is owned by the repo, so
  // we assert the service forwards the call shape to upsertCompassWithHistory.
  test("AC-1: updateCompass delegates to repo upsertCompassWithHistory", async () => {
    const { repo, mocks } = fakeRepo({});
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
    });
    const out = await service.updateCompass("user-A", { objectif: 800_000, horizonYears: 25 });
    expect(out).toEqual({ objectif: 800_000, horizonYears: 25 });
    expect(mocks.upsert).toHaveBeenCalledWith("user-A", {
      objectif: 800_000,
      horizonYears: 25,
    });
  });

  test("getCompass returns null when no row exists", async () => {
    const { repo } = fakeRepo({ findResult: null });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
    });
    expect(await service.getCompass("user-A")).toBeNull();
  });

  // AC-4 (verbatim from story 1-1 L19): with the stub milestonePresenceProbe
  // (always false), getSetupState returns 'incomplete' regardless of compass row.
  test("AC-4 (no compass): getSetupState returns 'incomplete' AND skips the probe", async () => {
    const { repo } = fakeRepo({ findResult: null });
    // Track that the probe is NOT called when no compass row exists — the
    // early-return contract was previously implicit; this pins it.
    const probeMock = mock(async (_userId: string) => true);
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: { hasAny: probeMock },
      wealthHistoryProvider: fakeWealth([]),
    });
    expect(await service.getSetupState("user-A")).toBe("incomplete");
    expect(probeMock).not.toHaveBeenCalled();
  });

  test("AC-4 (compass + no milestone, stub probe): getSetupState returns 'incomplete'", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
    });
    expect(await service.getSetupState("user-A")).toBe("incomplete");
  });

  // AC-4 second branch (verbatim): with a wired probe returning true AND a
  // compass row exists, the service would return 'complete'.
  test("AC-4 (compass + milestone, simulated probe): getSetupState returns 'complete'", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(true),
      wealthHistoryProvider: fakeWealth([]),
    });
    expect(await service.getSetupState("user-A")).toBe("complete");
  });

  // Probe rejection: getSetupState has no try/catch — pin the propagation
  // contract so a future refactor doesn't silently swallow the failure (which
  // would lie about setup state to the dashboard).
  test("getSetupState propagates probe rejection (mapped to INTERNAL upstream)", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: {
        hasAny: async () => {
          throw new Error("probe boom");
        },
      },
      wealthHistoryProvider: fakeWealth([]),
    });
    await expect(service.getSetupState("user-A")).rejects.toThrow("probe boom");
  });

  // AC-3 (verbatim): computeProgress({ currentWealth: 60_000, capitalTarget:
  // 800_000 }) returns { percent: 7.5, gap: 740_000 }.
  test("AC-3: computeProgress proxies to the pure helper", () => {
    const { repo } = fakeRepo({});
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
    });
    expect(service.computeProgress({ currentWealth: 60_000, capitalTarget: 800_000 })).toEqual({
      percent: 7.5,
      gap: 740_000,
    });
  });

  // ─── getCompassCurve (story 1-3) ──────────────────────────────────────

  // AC-1 (verbatim from story 1-3 L16): user A has compass (objectif=800_000,
  // horizonYears=25), earliest valuedOn = 2024-01-15T00:00:00Z, 3 wealth
  // snapshots → service returns startedAt + actual[3] + plan[6] aligned at
  // the same dates as actual.
  test("AC-1: getCompassCurve composes compass + start + snapshots into a curve", async () => {
    const startDate = new Date("2024-01-15T00:00:00Z");
    const snapshots: WealthSnapshot[] = [
      { at: new Date("2024-12-28T00:00:00Z"), totalEur: 10_000 },
      { at: new Date("2025-06-28T00:00:00Z"), totalEur: 20_000 },
      { at: new Date("2026-04-28T00:00:00Z"), totalEur: 35_000 },
    ];
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: startDate,
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth(snapshots),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });

    const curve = await service.getCompassCurve("user-A");
    expect(curve.startedAt.getTime()).toBe(startDate.getTime());
    expect(curve.actual).toHaveLength(3);
    // 6 plan points: startDate + 3 snapshot dates + today + endDate.
    expect(curve.plan).toHaveLength(6);
    // Align: each actual[].at exists in plan[].
    for (const a of curve.actual) {
      expect(curve.plan.some((p) => p.at.getTime() === a.at.getTime())).toBe(true);
    }
  });

  // AC-2 (verbatim from story 1-3 L17): compass + earliest valuedOn + 0
  // snapshots → actual === [], plan === [startDate, today, endDate].
  test("AC-2: getCompassCurve with zero snapshots returns plan-only curve", async () => {
    const startDate = new Date("2024-01-15T00:00:00Z");
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: startDate,
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });
    const curve = await service.getCompassCurve("user-A");
    expect(curve.actual).toEqual([]);
    expect(curve.plan).toHaveLength(3);
    expect(curve.plan[0]!.eur).toBeCloseTo(0, 6);
    expect(curve.plan[2]!.eur).toBeCloseTo(800_000, 6);
  });

  // AC-3 (verbatim from story 1-3 L18): user A has NO Hypothesis row → reject
  // with CompassError("COMPASS_NOT_FOUND", "compass not set"). HTTP-mapping
  // (404) is the error-mapper's job; here we pin the typed error.
  test("AC-3: getCompassCurve rejects with COMPASS_NOT_FOUND when no compass row", async () => {
    const { repo } = fakeRepo({ findResult: null });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });
    await expect(service.getCompassCurve("user-A")).rejects.toThrow(CompassError);
    await expect(service.getCompassCurve("user-A")).rejects.toThrow("compass not set");
  });

  // AC-4 (verbatim from story 1-3 L19): compass row but compass_history
  // returns null for the start date (impossible by 1-1's atomic upsert;
  // defensive guard) → reject with CompassError("TRANSACTION_FAILED",
  // "compass history missing — invariant violation"). HTTP 500.
  test("AC-4: getCompassCurve rejects with TRANSACTION_FAILED when start date missing", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: null,
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });
    await expect(service.getCompassCurve("user-A")).rejects.toThrow(CompassError);
    await expect(service.getCompassCurve("user-A")).rejects.toThrow("invariant");
  });

  // AC-9 (verbatim from story 1-3 L24): a MonthlyTracking row with capitalTotal
  // = Decimal("1500000000000.99") above MAX_SAFE_INTEGER × 0.166 — when the
  // wealth provider reads it, the value is coerced via decimalToNumber and
  // surfaces as a finite JS number; Number(decimal) is NOT used. The unit test
  // asserts Number.isFinite and the .toString() of the coerced number ≠
  // "1500000000000.99" (precision lost when leaving Decimal). Service-side we
  // pin: a finite-but-large totalEur passes through the curve unchanged.
  test("AC-9: large finite totalEur surfaces unchanged through the service", async () => {
    const startDate = new Date("2024-01-15T00:00:00Z");
    // Pre-coerced value (T9 is the coercion site; here we pin the service does
    // not double-coerce or reject a finite large number).
    const largeButFinite = 1_500_000_000_000.99;
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: startDate,
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([
        { at: new Date("2025-06-28T00:00:00Z"), totalEur: largeButFinite },
      ]),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });
    const curve = await service.getCompassCurve("user-A");
    expect(curve.actual).toHaveLength(1);
    expect(Number.isFinite(curve.actual[0]!.eur)).toBe(true);
    expect(curve.actual[0]!.eur).toBe(largeButFinite);
  });

  // Determinism / clock injection (story 1-3 §"Testing approach"): two calls
  // with the same fixed clock produce deeply-equal outputs. Pins that the
  // service does not re-read the clock between async hops.
  test("getCompassCurve is deterministic under a fixed clock", async () => {
    const startDate = new Date("2024-01-15T00:00:00Z");
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: startDate,
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([
        { at: new Date("2025-01-15T00:00:00Z"), totalEur: 12_000 },
      ]),
      clock: fixedClock("2026-05-09T12:00:00Z"),
    });
    const out1 = await service.getCompassCurve("user-A");
    const out2 = await service.getCompassCurve("user-A");
    expect(out1).toEqual(out2);
  });

  // ─── getCurrentProgress (story 1-4, FR-5) ─────────────────────────────

  // AC-1 (verbatim from story 1-4 L16): user A has compass (objectif=800_000,
  // horizonYears=25), AND ≥1 MonthlyTracking row whose capitalTotal=180_400
  // → percent = (180_400 / 800_000) × 100 = 22.55 → 22.6 (1 decimal); gap =
  // 800_000 - 180_400 = 619_600.
  test("AC-1 happy path: compass + wealth snapshots → percent 22.6 / gap 619_600", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 800_000, horizonYears: 25 },
      findStartResult: new Date("2024-01-15T00:00:00Z"),
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(true),
      wealthHistoryProvider: fakeWealth([
        { at: new Date("2025-12-28T00:00:00Z"), totalEur: 100_000 },
        { at: new Date("2026-04-28T00:00:00Z"), totalEur: 180_400 },
      ]),
    });
    const out = await service.getCurrentProgress("user-A");
    expect(out).toEqual({
      currentWealth: 180_400,
      objectif: 800_000,
      horizonYears: 25,
      percent: 22.6,
      gap: 619_600,
    });
  });

  // Empty wealth history (fresh user — only the compass row exists). The
  // pure helper accepts 0 as a valid currentWealth; service surfaces percent=0
  // and gap=objectif so the donut renders empty rather than throwing.
  test("zero snapshots → currentWealth=0, percent=0, gap=objectif", async () => {
    const { repo } = fakeRepo({
      findResult: { objectif: 500_000, horizonYears: 10 },
      findStartResult: new Date("2024-01-15T00:00:00Z"),
    });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(true),
      wealthHistoryProvider: fakeWealth([]),
    });
    const out = await service.getCurrentProgress("user-A");
    expect(out).toEqual({
      currentWealth: 0,
      objectif: 500_000,
      horizonYears: 10,
      percent: 0,
      gap: 500_000,
    });
  });

  // AC-3 mirror at the service layer: no compass row → COMPASS_NOT_FOUND.
  // HTTP 404 mapping is the error-mapper's job.
  test("no compass row → CompassError COMPASS_NOT_FOUND", async () => {
    const { repo } = fakeRepo({ findResult: null });
    const service = createCompassService({
      repository: repo,
      milestonePresenceProbe: probe(false),
      wealthHistoryProvider: fakeWealth([]),
    });
    await expect(service.getCurrentProgress("user-A")).rejects.toThrow(/compass not set/);
  });
});
