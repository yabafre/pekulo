// apps/api/src/modules/realestate/realestate.service.test.ts
// Service-layer tests (story 4-1). Mocks the repository and asserts:
//   - cross-aggregate guard before every mutation (REALESTATE_NOT_FOUND)
//   - outcome translation: MortgageAttachOutcome.duplicate →
//     MORTGAGE_ALREADY_ATTACHED; MortgageUpdateOutcome.not-found →
//     MORTGAGE_NOT_FOUND; same for rental
//   - detach idempotency (no error when child missing)
//   - happy paths delegate to the repository

import { describe, expect, mock, test } from "bun:test";
import type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
} from "@pekulo/validators";
import { RealestateError } from "./realestate.errors";
import type {
  MortgageAttachOutcome,
  MortgageUpdateOutcome,
  RealestateRepository,
  RentalAttachOutcome,
  RentalUpdateOutcome,
} from "./realestate.repository";
import { createRealestateService } from "./realestate.service";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const PROPERTY_A: RealEstate = {
  id: "res_aaaaaaaaaaaaaaaaaaaaa",
  userId: USER_A,
  label: "X",
  propertyType: "locatif",
  currentValuation: 200_000,
  lastValuedOn: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakeRepo(overrides: Partial<RealestateRepository> = {}): RealestateRepository {
  return {
    createProperty: mock(async () => PROPERTY_A),
    findByIdForUser: mock(async () => PROPERTY_A),
    listByUser: mock(async () => [PROPERTY_A]),
    findMortgageForUser: mock(async () => null),
    findRentalForUser: mock(async () => null),
    attachMortgage: mock(
      async (): Promise<MortgageAttachOutcome> => ({
        outcome: "ok",
        mortgage: {} as RealEstateMortgage,
      }),
    ),
    updateMortgage: mock(
      async (): Promise<MortgageUpdateOutcome> => ({
        outcome: "ok",
        mortgage: {} as RealEstateMortgage,
      }),
    ),
    detachMortgage: mock(async () => ({ ok: true as const })),
    attachRental: mock(
      async (): Promise<RentalAttachOutcome> => ({
        outcome: "ok",
        rental: {} as RealEstateRental,
      }),
    ),
    updateRental: mock(
      async (): Promise<RentalUpdateOutcome> => ({
        outcome: "ok",
        rental: {} as RealEstateRental,
      }),
    ),
    detachRental: mock(async () => ({ ok: true as const })),
    recordValuation: mock(async () => PROPERTY_A),
    listValuations: mock(async () => [] as RealEstateValuation[]),
    deleteProperty: mock(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe("realestate.service — cross-user guard", () => {
  // AC-5 (verbatim from story 4-1-realestate-domain L21):
  //   When B (different user) calls listValuations({ propertyId: A's res_… }),
  //   the service rejects with REALESTATE_NOT_FOUND → HTTP 404.
  // (Mirrored on attach* / update* / detach* / recordValuation / getProperty
  //  / deleteProperty — every mutation pre-flights findByIdForUser.)
  test("attachMortgage on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachMortgage(USER_A, {
        propertyId: "res_xxxxxxxxxxxxxxxxxxxxx",
        outstandingPrincipal: 100_000,
        annualRate: 0.02,
        monthlyPayment: 500,
        termMonths: 240,
        startDate: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RealestateError);
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });

  test("recordValuation on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.recordValuation(USER_A, {
        propertyId: "res_xxxxxxxxxxxxxxxxxxxxx",
        amount: 250_000,
        valuedOn: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });

  test("listValuations on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.listValuations(USER_A, { propertyId: "res_xxxxxxxxxxxxxxxxxxxxx" });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });

  test("deleteProperty on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.deleteProperty(USER_A, { id: "res_xxxxxxxxxxxxxxxxxxxxx" });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });
});

describe("realestate.service — mortgage lifecycle", () => {
  // AC-2 (verbatim from story 4-1-realestate-domain L18 — service half):
  //   Second attach → MORTGAGE_ALREADY_ATTACHED → HTTP 409.
  //   updateMortgage on a property WITHOUT a mortgage → MORTGAGE_NOT_FOUND → 404.
  //   detachMortgage idempotent — returns { ok: true } regardless of state.
  test("attachMortgage duplicate → MORTGAGE_ALREADY_ATTACHED", async () => {
    const repo = fakeRepo({
      attachMortgage: mock(async (): Promise<MortgageAttachOutcome> => ({ outcome: "duplicate" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachMortgage(USER_A, {
        propertyId: PROPERTY_A.id,
        outstandingPrincipal: 100_000,
        annualRate: 0.02,
        monthlyPayment: 500,
        termMonths: 240,
        startDate: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("MORTGAGE_ALREADY_ATTACHED");
    }
  });

  test("updateMortgage missing → MORTGAGE_NOT_FOUND", async () => {
    const repo = fakeRepo({
      updateMortgage: mock(async (): Promise<MortgageUpdateOutcome> => ({ outcome: "not-found" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.updateMortgage(USER_A, { propertyId: PROPERTY_A.id, monthlyPayment: 600 });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("MORTGAGE_NOT_FOUND");
    }
  });

  test("detachMortgage idempotent — never throws", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(await service.detachMortgage(USER_A, { propertyId: PROPERTY_A.id })).toEqual({
      ok: true,
    });
  });
});

describe("realestate.service — rental lifecycle (mirror of mortgage)", () => {
  // AC-3 (verbatim from story 4-1-realestate-domain L19 — service half):
  //   Mirror of AC-2 for rental.
  test("attachRental duplicate → RENTAL_ALREADY_ATTACHED", async () => {
    const repo = fakeRepo({
      attachRental: mock(async (): Promise<RentalAttachOutcome> => ({ outcome: "duplicate" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachRental(USER_A, {
        propertyId: PROPERTY_A.id,
        monthlyRent: 1000,
        monthlyCharges: 100,
        furnished: false,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("RENTAL_ALREADY_ATTACHED");
    }
  });

  test("updateRental missing → RENTAL_NOT_FOUND", async () => {
    const repo = fakeRepo({
      updateRental: mock(async (): Promise<RentalUpdateOutcome> => ({ outcome: "not-found" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.updateRental(USER_A, { propertyId: PROPERTY_A.id, monthlyRent: 1100 });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("RENTAL_NOT_FOUND");
    }
  });
});

describe("realestate.service — happy paths delegate to repo", () => {
  test("createProperty → returns repo output", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(
      await service.createProperty(USER_A, {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: new Date(),
      }),
    ).toEqual(PROPERTY_A);
  });

  test("recordValuation → returns updated property", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(
      await service.recordValuation(USER_A, {
        propertyId: PROPERTY_A.id,
        amount: 280_000,
        valuedOn: new Date(),
      }),
    ).toEqual(PROPERTY_A);
  });

  test("deleteProperty → { ok: true }", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(await service.deleteProperty(USER_A, { id: PROPERTY_A.id })).toEqual({ ok: true });
  });
});
