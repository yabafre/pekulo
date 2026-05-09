import { describe, expect, mock, test } from "bun:test";
import type { Compass, MilestonePresenceProbe } from "@pekulo/types";
import { createCompassService } from "./compass.service";
import type { CompassRepository } from "./compass.repository";

function fakeRepo(behaviour: { findResult?: Compass | null; upsertResult?: Compass }): {
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
  const findStart = mock(async (_userId: string) => null);
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
    });
    expect(service.computeProgress({ currentWealth: 60_000, capitalTarget: 800_000 })).toEqual({
      percent: 7.5,
      gap: 740_000,
    });
  });
});
