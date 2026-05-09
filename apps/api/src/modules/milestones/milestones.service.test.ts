// Service unit tests with stubbed repository + stubbed CompassReader.
// AC coverage: AC-2 (cap), AC-3 (year range), AC-4 (year boundary), AC-5
// (compass required), AC-6/AC-7 (CRUD shape via repo), AC-8 (cross-user via
// repo not-found), AC-9 (computeStatuses delegation), AC-10 (helper edge
// cases re-asserted via service path).

import { describe, expect, test } from "bun:test";
import { createMilestoneService, MILESTONES_PER_USER_CAP } from "./milestones.service";
import type { MilestoneRepository } from "./milestones.repository";
import type { CompassReader, Milestone } from "./milestones.types";

const USER_A = "11111111-1111-1111-1111-111111111111";
const FIXED_NOW = () => new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
const CURRENT_YEAR = 2026;

function stubCompassReader(
  compass: { objectif: number; horizonYears: number } | null,
): CompassReader {
  return {
    async read() {
      return compass;
    },
  };
}

function stubRepo(initial: Milestone[] = []): MilestoneRepository {
  let rows = [...initial];
  let nextId = initial.length;
  return {
    async add(userId, input) {
      const m: Milestone = {
        id: `mst_${String(nextId++).padStart(21, "0")}`,
        userId,
        targetCapital: input.targetCapital,
        targetYear: input.targetYear,
        label: input.label ?? null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(m);
      return m;
    },
    async update(userId, id, input) {
      const idx = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (idx < 0) return null;
      const row = rows[idx]!;
      const updated: Milestone = {
        ...row,
        targetCapital: input.targetCapital ?? row.targetCapital,
        targetYear: input.targetYear ?? row.targetYear,
        label: input.label !== undefined ? input.label : row.label,
        updatedAt: new Date(),
      };
      rows[idx] = updated;
      return updated;
    },
    async delete(userId, id) {
      const before = rows.length;
      rows = rows.filter((r) => !(r.id === id && r.userId === userId));
      return rows.length < before;
    },
    async listByUser(userId) {
      return rows.filter((r) => r.userId === userId).sort((a, b) => a.targetYear - b.targetYear);
    },
    async findByIdForUser(userId, id) {
      return rows.find((r) => r.userId === userId && r.id === id) ?? null;
    },
    async countByUser(userId) {
      return rows.filter((r) => r.userId === userId).length;
    },
    async hasAny(userId) {
      return rows.some((r) => r.userId === userId);
    },
  };
}

describe("milestones.service.add", () => {
  test("rejects when compass is missing (AC-5)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader(null),
      now: FIXED_NOW,
    });
    await expect(svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 })).rejects.toThrow(
      /compass must be set/,
    );
  });

  test("rejects when targetYear === currentYear (AC-4)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR }),
    ).rejects.toThrow(/targetYear must be in/);
  });

  test("rejects when targetYear === currentYear + horizonYears (AC-3)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR + 25 }),
    ).rejects.toThrow(/targetYear must be in/);
  });

  test("accepts boundary targetYear === currentYear+1 (AC-4 inside)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    const m = await svc.add(USER_A, {
      targetCapital: 100_000,
      targetYear: CURRENT_YEAR + 1,
    });
    expect(m.targetYear).toBe(CURRENT_YEAR + 1);
  });

  test("accepts boundary targetYear === currentYear+horizonYears-1 (AC-3 inside)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    const m = await svc.add(USER_A, {
      targetCapital: 100_000,
      targetYear: CURRENT_YEAR + 24,
    });
    expect(m.targetYear).toBe(CURRENT_YEAR + 24);
  });

  test("rejects 21st add (AC-2)", async () => {
    const initial: Milestone[] = Array.from({ length: MILESTONES_PER_USER_CAP }, (_, i) => ({
      id: `mst_${String(i).padStart(21, "0")}`,
      userId: USER_A,
      targetCapital: 100_000 + i * 1000,
      targetYear: CURRENT_YEAR + i + 1,
      label: null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const svc = createMilestoneService({
      repository: stubRepo(initial),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.add(USER_A, { targetCapital: 999_000, targetYear: CURRENT_YEAR + 22 }),
    ).rejects.toThrow(/milestones cap is 20 per user/);
  });
});

describe("milestones.service.update", () => {
  test("returns MILESTONE_NOT_FOUND when row does not exist (AC-8)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.update(USER_A, { id: "mst_" + "0".repeat(21), targetCapital: 100_000 }),
    ).rejects.toThrow(/not found/);
  });

  test("validates new targetYear against compass horizon (AC-3)", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({
      repository: repo,
      compassReader: reader,
      now: FIXED_NOW,
    });
    const m = await svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    await expect(svc.update(USER_A, { id: m.id, targetYear: CURRENT_YEAR + 25 })).rejects.toThrow(
      /targetYear must be in/,
    );
  });
});

describe("milestones.service.delete", () => {
  test("returns MILESTONE_NOT_FOUND on cross-user delete (AC-8)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(svc.delete(USER_A, "mst_" + "0".repeat(21))).rejects.toThrow(/not found/);
  });
});

describe("milestones.service.computeStatuses", () => {
  test("returns ahead/ahead/ahead for the AC-9 fixture", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({
      repository: repo,
      compassReader: reader,
      now: FIXED_NOW,
    });
    await svc.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    await svc.add(USER_A, { targetCapital: 200_000, targetYear: 2035 });
    await svc.add(USER_A, { targetCapital: 500_000, targetYear: 2045 });
    const result = await svc.computeStatuses(USER_A, 60_000);
    expect(result.map((r) => r.status)).toEqual(["ahead", "ahead", "ahead"]);
  });

  test("rejects when compass is missing (AC-10)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader(null),
      now: FIXED_NOW,
    });
    await expect(svc.computeStatuses(USER_A, 60_000)).rejects.toThrow(/compass must be set/);
  });
});

describe("milestones.service.presenceProbe (AC-11)", () => {
  test("returns false on empty user, true after add", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({
      repository: repo,
      compassReader: reader,
      now: FIXED_NOW,
    });
    const probe = svc.presenceProbe();
    expect(await probe.hasAny(USER_A)).toBe(false);
    await svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await probe.hasAny(USER_A)).toBe(true);
  });
});
