// 3 cases on a stubbed Prisma client. The fake client is a hand-rolled
// subset typed against `client.hypothesis.{findUnique, upsert}` only — the
// service does not touch any other model.

import { describe, expect, mock, test } from "bun:test";
import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
import { createHypothesisService } from "./hypothesis.service";

type UpsertArgs = {
  where: { userId: string };
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

function fakeClient(behaviour: { findUniqueResult?: unknown; upsertResult?: unknown }) {
  const findUnique = mock(async (_args: { where: { userId: string } }) =>
    behaviour.findUniqueResult ?? null,
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

  test("get maps a present row to camelCased Hypotheses", async () => {
    const row = {
      salaireNet: 4000,
      ticketRestoJour: 14,
      partEmployeurTr: 0.6,
      joursTravailles: 20,
      navigoCout: 90,
      partEmployeurNavigo: 0.5,
      mutuelleEconomie: 30,
      loyer: 1200,
      courses: 200,
      transport: 45,
      autresCharges: 150,
      sorties: 250,
      divers: 120,
      voyageMois: 600,
      creditMensuel: 250,
      dateDebutCredit: "01/2027",
      matelasCible: 10000,
      perfEtfAnnuelle: 0.07,
      augmentationSalaire: 0.03,
      partEtfMonde: 0.8,
      partOpportunites: 0.2,
      economieRemoteMois: 1000,
      moisRemoteAn: 6,
      revenuFreelanceMois: 300,
      horizonYears: 5,
      objectif: 120000,
    };
    const { client } = fakeClient({ findUniqueResult: row });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createHypothesisService({ client: client as any });
    const result = await service.get("user-uuid");
    expect(result.salaireNet).toBe(4000);
    expect(result.loyer).toBe(1200);
    expect(result.objectif).toBe(120000);
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
  });
});
