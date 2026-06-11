// Cases on a stubbed Prisma client. The fake client is a hand-rolled subset
// typed against `client.hypothesis.{findUnique, upsert}` only — the service
// does not touch any other model. The Decimal-fidelity case constructs a
// real `Prisma.Decimal` instance to verify the rowToHypotheses coercion
// matches what production receives at runtime.

import { describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
import { createHypothesisService } from "./hypothesis.service";

type UpsertArgs = {
  where: { userId: string };
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

function fakeClient(behaviour: { findUniqueResult?: unknown; upsertResult?: unknown }) {
  const findUnique = mock(
    async (_args: { where: { userId: string } }) => behaviour.findUniqueResult ?? null,
  );
  const upsert = mock(async (_args: UpsertArgs) => behaviour.upsertResult ?? null);
  return {
    client: {
      hypothesis: { findUnique, upsert },
    },
    mocks: { findUnique, upsert },
  };
}

describe("hypothesis.service", () => {
  test("get returns defaultHypotheses when row missing", async () => {
    const { client } = fakeClient({ findUniqueResult: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const result = await service.get("user-uuid");
    expect(result).toEqual(defaultHypotheses);
  });

  test("get maps a present row (Prisma.Decimal columns) to camelCased Hypotheses", async () => {
    // Postgres `@db.Decimal` columns surface as `Prisma.Decimal` instances.
    // Constructing the fixture with real Decimals exercises rowToHypotheses
    // through the same coercion path production uses. Plain numbers are
    // also accepted (the SmallInt `horizonYears` column).
    const row = {
      salaireNet: new Prisma.Decimal(4000),
      ticketRestoJour: new Prisma.Decimal(14),
      partEmployeurTr: new Prisma.Decimal("0.6"),
      joursTravailles: new Prisma.Decimal(20),
      navigoCout: new Prisma.Decimal(90),
      partEmployeurNavigo: new Prisma.Decimal("0.5"),
      mutuelleEconomie: new Prisma.Decimal(30),
      loyer: new Prisma.Decimal(1200),
      courses: new Prisma.Decimal(200),
      transport: new Prisma.Decimal(45),
      autresCharges: new Prisma.Decimal(150),
      sorties: new Prisma.Decimal(250),
      divers: new Prisma.Decimal(120),
      voyageMois: new Prisma.Decimal(600),
      creditMensuel: new Prisma.Decimal(250),
      dateDebutCredit: "01/2027",
      matelasCible: new Prisma.Decimal(10000),
      perfEtfAnnuelle: new Prisma.Decimal("0.07"),
      augmentationSalaire: new Prisma.Decimal("0.03"),
      partEtfMonde: new Prisma.Decimal("0.8"),
      partOpportunites: new Prisma.Decimal("0.2"),
      economieRemoteMois: new Prisma.Decimal(1000),
      moisRemoteAn: new Prisma.Decimal(6),
      revenuFreelanceMois: new Prisma.Decimal(300),
      horizonYears: 5, // SmallInt — plain number at runtime
      objectif: new Prisma.Decimal(120000),
    };
    const { client } = fakeClient({ findUniqueResult: row });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const result = await service.get("user-uuid");
    // Coerced via Decimal.toNumber() → finite JS numbers identical to inputs.
    expect(result.salaireNet).toBe(4000);
    expect(result.loyer).toBe(1200);
    expect(result.objectif).toBe(120000);
    expect(result.partEmployeurTr).toBe(0.6);
    expect(result.horizonYears).toBe(5);
  });

  test("get preserves precision at MAX_SAFE_INTEGER boundary (V1 tolerance budget)", async () => {
    // Persona Alex's V1 ranges sit comfortably below MAX_SAFE_INTEGER (2^53).
    // This test pins the boundary so a future field overflow is caught
    // explicitly rather than silently truncating. See lessons.md L6.
    const safe = Number.MAX_SAFE_INTEGER;
    const row = {
      ...Object.fromEntries(
        Object.keys(defaultHypotheses).map((k) =>
          k === "dateDebutCredit"
            ? [k, "01/2027"]
            : k === "horizonYears"
              ? [k, 5]
              : [k, new Prisma.Decimal(1)],
        ),
      ),
      objectif: new Prisma.Decimal(safe.toString()),
    };
    const { client } = fakeClient({ findUniqueResult: row });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const result = await service.get("user-uuid");
    expect(result.objectif).toBe(safe);
    expect(Number.isSafeInteger(result.objectif)).toBe(true);
  });

  test("save calls upsert with exact { where: { userId }, update, create } shape", async () => {
    const persistedRow = {
      ...defaultHypotheses,
      loyer: 1300,
    };
    const { client, mocks } = fakeClient({ upsertResult: persistedRow });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const input: Hypotheses = { ...defaultHypotheses, loyer: 1300 };
    const result = await service.save("user-uuid", input);
    expect(result.loyer).toBe(1300);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const call = mocks.upsert.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ userId: "user-uuid" });
    expect(call?.update.loyer).toBe(1300);
    expect(call?.create.userId).toBe("user-uuid");
    expect(call?.create.loyer).toBe(1300);
    // The prefixedIdsExtension injects `id` AFTER the service hands the
    // payload off; from the service's perspective `create.id` is undefined.
    expect(call?.create.id).toBeUndefined();
  });
});

describe("hypothesis.service — projection (story 7-3)", () => {
  test("recordProjection upserts only the four projection columns", async () => {
    const { client, mocks } = fakeClient({ upsertResult: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const input = {
      objectif: 800_000,
      horizonYears: 30,
      monthlyContribution: 1_000,
      perfEtfAnnuelle: 0.05,
    };
    const result = await service.recordProjection("user-uuid", input);
    expect(result).toEqual(input);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const call = mocks.upsert.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ userId: "user-uuid" });
    expect(call?.update).toEqual(input);
    expect(call?.create.userId).toBe("user-uuid");
    expect(call?.create.monthlyContribution).toBe(1_000);
    // Budget columns are NOT in the write payload — only the 4 projection fields.
    expect(Object.keys(call?.update ?? {}).sort()).toEqual(
      ["horizonYears", "monthlyContribution", "objectif", "perfEtfAnnuelle"].sort(),
    );
  });

  test("getProjection reads Decimal columns and returns the curve", async () => {
    const row = {
      objectif: new Prisma.Decimal(800_000),
      horizonYears: 30,
      perfEtfAnnuelle: new Prisma.Decimal("0.05"),
      monthlyContribution: new Prisma.Decimal(1_000),
    };
    const { client } = fakeClient({ findUniqueResult: row });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const out = await service.getProjection("user-uuid", 60_000);
    expect(out.horizonYears).toBe(30);
    expect(out.monthlyContribution).toBe(1_000);
    expect(out.annualRate).toBe(0.05);
    expect(out.points).toHaveLength(31);
    expect(out.points[0]!.eur).toBe(60_000);
  });

  test("getProjection falls back to defaults + 0 contribution when row missing", async () => {
    const { client } = fakeClient({ findUniqueResult: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const out = await service.getProjection("user-uuid", 1_000);
    expect(out.monthlyContribution).toBe(0);
    expect(out.annualRate).toBe(defaultHypotheses.perfEtfAnnuelle);
    expect(out.horizonYears).toBe(defaultHypotheses.horizonYears);
    expect(out.points[0]!.eur).toBe(1_000);
  });
});
