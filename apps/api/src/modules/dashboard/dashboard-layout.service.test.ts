// apps/api/src/modules/dashboard/dashboard-layout.service.test.ts
// Story 7-2 / D6 — per-user layout read/write trust boundary. The service
// re-parses the stored JSON on read (corrupt row → null → web falls back to
// the default registry layout, AC-6) and validates the input on write (AC-4,
// AC-5). The repository is stubbed; this exercises the validation logic only.
import { describe, expect, test } from "bun:test";
import {
  createDashboardLayoutService,
  type DashboardLayoutService,
} from "./dashboard-layout.service";
import type { DashboardLayoutRepository } from "./dashboard-layout.repository";
import type { DashboardLayout } from "@pekulo/validators";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const VALID: DashboardLayout = {
  widgets: [
    { id: "hero", visible: true, order: 0 },
    { id: "compass", visible: true, order: 1 },
    { id: "recentActivity", visible: false, order: 2 },
  ],
};

function svcWith(over: Partial<DashboardLayoutRepository> = {}): {
  svc: DashboardLayoutService;
  upserted: { userId: string; layout: DashboardLayout }[];
} {
  const upserted: { userId: string; layout: DashboardLayout }[] = [];
  const repository: DashboardLayoutRepository = {
    find: async () => null,
    upsert: async (userId, layout) => {
      upserted.push({ userId, layout });
      return layout;
    },
    ...over,
  };
  return { svc: createDashboardLayoutService({ repository }), upserted };
}

describe("dashboard-layout.service", () => {
  // AC-4/AC-5 (verbatim from story 7-2): the new order/visibility persists
  // server-side and survives a full reload.
  test("getLayout returns null when the repository has no row", async () => {
    const { svc } = svcWith({ find: async () => null });
    expect(await svc.getLayout(USER)).toBeNull();
  });

  test("getLayout returns the parsed layout on a valid row", async () => {
    const { svc } = svcWith({ find: async () => VALID });
    expect(await svc.getLayout(USER)).toEqual(VALID);
  });

  // AC-6 (verbatim from story 7-2): Given a stored layout that is absent,
  // malformed, or references unknown widget ids, When the Cap view loads, Then
  // it renders the default layout and never throws. The service degrades a bad
  // row to null so the web falls back to defaults.
  test("getLayout returns null on a malformed row (unknown widget id)", async () => {
    const malformed = {
      widgets: [{ id: "bogus", visible: true, order: 0 }],
    } as unknown as DashboardLayout;
    const { svc } = svcWith({ find: async () => malformed });
    expect(await svc.getLayout(USER)).toBeNull();
  });

  test("saveLayout rejects an invalid widget id", async () => {
    const bad = {
      widgets: [{ id: "bogus", visible: true, order: 0 }],
    } as unknown as DashboardLayout;
    const { svc, upserted } = svcWith();
    await expect(svc.saveLayout(USER, bad)).rejects.toThrow();
    expect(upserted).toHaveLength(0);
  });

  test("saveLayout validates then upserts a valid layout", async () => {
    const { svc, upserted } = svcWith();
    const out = await svc.saveLayout(USER, VALID);
    expect(out).toEqual(VALID);
    expect(upserted).toEqual([{ userId: USER, layout: VALID }]);
  });
});
