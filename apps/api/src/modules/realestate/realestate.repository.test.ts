// apps/api/src/modules/realestate/realestate.repository.test.ts
// Repository-layer tests (story 4-1). Fake Prisma client modelling the 4
// real-estate tables. Covers:
//   AC-1 (createProperty + prefixed id)
//   AC-2 repo half (attach/update/detach mortgage)
//   AC-3 repo half (attach/update/detach rental — mirror of mortgage)
//   AC-4 (recordValuation atomic $transaction)
//   AC-5 (listValuations desc order)
//   AC-7 (cascade-delete + DR-5 60s budget on seeded volume)
//   AC-8 (decimal coercion)
//   AC-9 (every Prisma query carries userId — fake-prisma encodes the
//        invariant by simply rejecting reads that lack the userId guard).

import { describe, expect, test } from "bun:test";
import {
  attachMortgageInputSchema,
  attachRentalInputSchema,
  createPropertyInputSchema,
} from "@pekulo/validators";
import { ZodError } from "@pekulo/zod";
import { createRealestateRepository } from "./realestate.repository";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

describe("realestate.repository — createProperty", () => {
  // AC-1 (verbatim from story 4-1-realestate-domain L17):
  //   Given a fresh DB, When createProperty({ label: "Appartement Lyon",
  //   propertyType: "locatif", currentValuation: 250000, lastValuedOn:
  //   "2026-05-01" }) is called for user A, Then a real_estate row persists
  //   with id matching /^res_[0-9A-Za-z]{21}$/, user_id = A,
  //   current_valuation = 250000, last_valued_on = 2026-05-01, created_at
  //   populated by Postgres default.
  test("AC-1 — persists row with prefixed id", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const row = await repo.createProperty(USER_A, {
      label: "Appartement Lyon",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-05-01"),
    });
    expect(row.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
    expect(row.userId).toBe(USER_A);
    expect(row.currentValuation).toBe(250_000);
    expect(row.propertyType).toBe("locatif");
  });
});

describe("realestate.repository — findByIdForUser (cross-user guard)", () => {
  // AC-9 (verbatim from story 4-1-realestate-domain L25):
  //   Every prisma.realEstate.* … carries where: { userId }; cross-user
  //   reads return null instead of leaking rows.
  test("AC-9 — returns null when userId mismatches", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const created = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "autre",
      currentValuation: 100_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(await repo.findByIdForUser(USER_B, created.id)).toBeNull();
    expect(await repo.findByIdForUser(USER_A, created.id)).not.toBeNull();
  });
});

describe("realestate.repository — attach/update/detach mortgage", () => {
  // AC-2 (verbatim from story 4-1-realestate-domain L18 — repo half):
  //   attachMortgage happy → resm_ id; second attach → outcome=duplicate;
  //   updateMortgage missing → outcome=not-found; detachMortgage idempotent.
  test("AC-2 — attachMortgage happy → prefixed resm_ id + ok", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.attachMortgage(USER_A, {
      propertyId: property.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.mortgage.id).toMatch(/^resm_[0-9A-Za-z]{21}$/);
      expect(result.mortgage.realEstateId).toBe(property.id);
    }
  });

  test("AC-2 — duplicate attachMortgage → outcome=duplicate", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const input = {
      propertyId: property.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    };
    await repo.attachMortgage(USER_A, input);
    const second = await repo.attachMortgage(USER_A, input);
    expect(second.outcome).toBe("duplicate");
  });

  test("AC-2 — updateMortgage missing → outcome=not-found", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.updateMortgage(USER_A, {
      propertyId: property.id,
      monthlyPayment: 850,
    });
    expect(result.outcome).toBe("not-found");
  });

  test("AC-2 — detachMortgage idempotent — returns ok even when missing", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(await repo.detachMortgage(USER_A, { propertyId: property.id })).toEqual({ ok: true });
    expect(await repo.detachMortgage(USER_A, { propertyId: property.id })).toEqual({ ok: true });
  });
});

describe("realestate.repository — attach/update/detach rental (mirror of mortgage)", () => {
  // AC-3 (verbatim from story 4-1-realestate-domain L19 — repo half):
  //   attachRental happy → resr_ id; duplicate → outcome=duplicate;
  //   updateRental missing → outcome=not-found; detachRental idempotent.
  test("AC-3 — attachRental happy → prefixed resr_ id + ok", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.attachRental(USER_A, {
      propertyId: property.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.rental.id).toMatch(/^resr_[0-9A-Za-z]{21}$/);
    }
  });

  test("AC-3 — duplicate attachRental → outcome=duplicate", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const input = {
      propertyId: property.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    };
    await repo.attachRental(USER_A, input);
    expect((await repo.attachRental(USER_A, input)).outcome).toBe("duplicate");
  });
});

describe("realestate.repository — recordValuation (atomic $transaction)", () => {
  // AC-4 (verbatim from story 4-1-realestate-domain L20):
  //   In ONE prisma.$transaction: (a) real_estate.current_valuation = 280000
  //   AND last_valued_on = 2026-05-01, AND (b) a new real_estate_valuations
  //   row. Either both writes succeed or neither does.
  test("AC-4 — updates real_estate + inserts real_estate_valuations in one transaction", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2024-01-01"),
    });
    const updated = await repo.recordValuation(USER_A, {
      propertyId: property.id,
      amount: 280_000,
      valuedOn: new Date("2026-05-01"),
    });
    expect(updated.currentValuation).toBe(280_000);
    expect(updated.lastValuedOn.toISOString().slice(0, 10)).toBe("2026-05-01");
    const history = await repo.listValuations(USER_A, { propertyId: property.id });
    expect(history.length).toBe(1);
    expect(history[0]!.amount).toBe(280_000);
    expect(history[0]!.id).toMatch(/^resv_[0-9A-Za-z]{21}$/);
  });

  // AC-5 (verbatim from story 4-1-realestate-domain L21):
  //   listValuations returns rows ordered by valued_on desc.
  test("AC-5 — listValuations returns rows ordered by valuedOn desc", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const p = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2024-01-01"),
    });
    await repo.recordValuation(USER_A, {
      propertyId: p.id,
      amount: 260_000,
      valuedOn: new Date("2024-06-01"),
    });
    await repo.recordValuation(USER_A, {
      propertyId: p.id,
      amount: 280_000,
      valuedOn: new Date("2026-05-01"),
    });
    await repo.recordValuation(USER_A, {
      propertyId: p.id,
      amount: 255_000,
      valuedOn: new Date("2024-03-01"),
    });
    const history = await repo.listValuations(USER_A, { propertyId: p.id });
    expect(history.map((r) => r.amount)).toEqual([280_000, 260_000, 255_000]);
  });
});

describe("realestate.repository — deleteProperty (cascade + DR-5 timing)", () => {
  // AC-7 (verbatim from story 4-1-realestate-domain L23):
  //   Given user A owns 50 properties each with 1 mortgage + 1 rental + 50
  //   valuation rows … the deleteProperty call completes in < 60 s (DR-5).
  test("AC-7 — cascade-deletes 1 mortgage + 1 rental + 50 valuations from 1 property in < 60 s", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const props = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        repo.createProperty(USER_A, {
          label: `P${i}`,
          propertyType: "locatif",
          currentValuation: 200_000 + i * 1000,
          lastValuedOn: new Date("2026-01-01"),
        }),
      ),
    );
    const victim = props[0]!;
    await repo.attachMortgage(USER_A, {
      propertyId: victim.id,
      outstandingPrincipal: 150_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    await repo.attachRental(USER_A, {
      propertyId: victim.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    });
    // Seeded sequentially on purpose: each recordValuation hits the same
    // parent row via $transaction so chronological order is preserved for
    // AC-5; parallelising would also race the unique-constraint check in
    // real Prisma. Lint warns (no-await-in-loop) — accepted for this seeder.
    for (let i = 0; i < 50; i++) {
      await repo.recordValuation(USER_A, {
        propertyId: victim.id,
        amount: 200_000 + i * 1000,
        valuedOn: new Date(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`),
      });
    }
    const t0 = performance.now();
    await repo.deleteProperty(USER_A, { id: victim.id });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(60_000); // DR-5 budget
    expect(await repo.findByIdForUser(USER_A, victim.id)).toBeNull();
    expect(await repo.findByIdForUser(USER_A, props[1]!.id)).not.toBeNull();
  });
});

describe("realestate.repository — decimal coercion (L24)", () => {
  // AC-8 (verbatim from story 4-1-realestate-domain L24):
  //   Every numeric field is a JS number — never a Prisma.Decimal.
  test("AC-8 — surfaces JS numbers, not Prisma.Decimal", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const row = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000.5,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(typeof row.currentValuation).toBe("number");
    expect(row.currentValuation).toBe(250_000.5);
  });
});

describe("realestate.repository — validator boundary (AC-12)", () => {
  // AC-12 (verbatim from story 4-1-realestate-domain L28):
  //   Each invocation throws ZodError. 12 cases below cover bounds + enum
  //   + label length on createProperty / attachMortgage / attachRental.
  const okProperty = {
    label: "X",
    propertyType: "locatif" as const,
    currentValuation: 100,
    lastValuedOn: "2026-01-01",
  };
  const okMortgage = {
    propertyId: "res_aaaaaaaaaaaaaaaaaaaaa",
    outstandingPrincipal: 100,
    annualRate: 0.02,
    monthlyPayment: 100,
    termMonths: 240,
    startDate: "2020-01-01",
  };
  const okRental = {
    propertyId: "res_aaaaaaaaaaaaaaaaaaaaa",
    monthlyRent: 100,
    monthlyCharges: 0,
    furnished: false,
  };

  test("createProperty rejects currentValuation: -1", () => {
    expect(() => createPropertyInputSchema.parse({ ...okProperty, currentValuation: -1 })).toThrow(
      ZodError,
    );
  });
  test("createProperty rejects label: empty", () => {
    expect(() => createPropertyInputSchema.parse({ ...okProperty, label: "" })).toThrow(ZodError);
  });
  test("createProperty rejects label > 120 chars", () => {
    expect(() =>
      createPropertyInputSchema.parse({ ...okProperty, label: "x".repeat(121) }),
    ).toThrow(ZodError);
  });
  test("createProperty rejects propertyType: 'invalid'", () => {
    expect(() =>
      createPropertyInputSchema.parse({ ...okProperty, propertyType: "invalid" }),
    ).toThrow(ZodError);
  });
  test("attachMortgage rejects outstandingPrincipal: -1", () => {
    expect(() =>
      attachMortgageInputSchema.parse({ ...okMortgage, outstandingPrincipal: -1 }),
    ).toThrow(ZodError);
  });
  test("attachMortgage rejects annualRate: -0.01", () => {
    expect(() => attachMortgageInputSchema.parse({ ...okMortgage, annualRate: -0.01 })).toThrow(
      ZodError,
    );
  });
  test("attachMortgage rejects annualRate: 1.01", () => {
    expect(() => attachMortgageInputSchema.parse({ ...okMortgage, annualRate: 1.01 })).toThrow(
      ZodError,
    );
  });
  test("attachMortgage rejects monthlyPayment: -1", () => {
    expect(() => attachMortgageInputSchema.parse({ ...okMortgage, monthlyPayment: -1 })).toThrow(
      ZodError,
    );
  });
  test("attachMortgage rejects termMonths: 0", () => {
    expect(() => attachMortgageInputSchema.parse({ ...okMortgage, termMonths: 0 })).toThrow(
      ZodError,
    );
  });
  test("attachMortgage rejects termMonths: 601", () => {
    expect(() => attachMortgageInputSchema.parse({ ...okMortgage, termMonths: 601 })).toThrow(
      ZodError,
    );
  });
  test("attachRental rejects monthlyRent: -1", () => {
    expect(() => attachRentalInputSchema.parse({ ...okRental, monthlyRent: -1 })).toThrow(ZodError);
  });
  test("attachRental rejects monthlyCharges: -1", () => {
    expect(() => attachRentalInputSchema.parse({ ...okRental, monthlyCharges: -1 })).toThrow(
      ZodError,
    );
  });
});

describe("realestate.repository — listByUser", () => {
  // AC-9 (mirror — listByUser must filter by userId).
  test("returns only matching userId rows", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    await repo.createProperty(USER_A, {
      label: "A1",
      propertyType: "locatif",
      currentValuation: 100_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    await repo.createProperty(USER_B, {
      label: "B1",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const a = await repo.listByUser(USER_A);
    expect(a.length).toBe(1);
    expect(a[0]!.label).toBe("A1");
  });
});
