// apps/api/src/modules/realestate/realestate.module.test.ts
// Whole-module wired flow on fake Prisma (story 4-1). Asserts the factory
// composes repository + service + router and that the service surface
// roundtrips through the fake.

import { describe, expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";
import { createRealestateModule } from "./realestate.module";

const USER_A = "00000000-0000-0000-0000-00000000000a";

function fakePrismaService(): PrismaService {
  const fake = makeFakePrisma();
  return { client: fake.client } as unknown as PrismaService;
}

describe("realestate.module — whole-module wired flow", () => {
  test("createRealestateModule returns service + router", () => {
    const mod = createRealestateModule({ prismaService: fakePrismaService() });
    expect(typeof mod.service.createProperty).toBe("function");
    expect(typeof mod.router).toBe("object");
  });

  test("service.createProperty round-trip → repo persisted", async () => {
    const mod = createRealestateModule({ prismaService: fakePrismaService() });
    const property = await mod.service.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-05-01"),
    });
    expect(property.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
    const listed = await mod.service.listProperties(USER_A);
    expect(listed.length).toBe(1);
    expect(listed[0]!.id).toBe(property.id);
  });

  test("recordValuation atomic + listValuations desc — wired end-to-end", async () => {
    const mod = createRealestateModule({ prismaService: fakePrismaService() });
    const p = await mod.service.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2024-01-01"),
    });
    await mod.service.recordValuation(USER_A, {
      propertyId: p.id,
      amount: 260_000,
      valuedOn: new Date("2024-06-01"),
    });
    await mod.service.recordValuation(USER_A, {
      propertyId: p.id,
      amount: 280_000,
      valuedOn: new Date("2026-05-01"),
    });
    const history = await mod.service.listValuations(USER_A, { propertyId: p.id });
    expect(history.map((r) => r.amount)).toEqual([280_000, 260_000]);
  });
});

describe("realestate.module — derives (story 4-2)", () => {
  test("AC-1 + AC-2 — wired flow returns cashflow=400 and equity=70000 via service", async () => {
    const fake = makeFakePrisma();
    const mod = createRealestateModule({
      prismaService: { client: fake.client } as unknown as PrismaService,
    });
    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const p = await mod.service.createProperty(userId, {
      label: "P-derive",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    await mod.service.attachMortgage(userId, {
      propertyId: p.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 600,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    await mod.service.attachRental(userId, {
      propertyId: p.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    });
    const derives = await mod.service.getPropertyDerives(userId, { id: p.id });
    expect(derives).toEqual({ monthlyCashFlowEur: 400, netEquityEur: 70_000 });
  });

  test("AC-3 — wired flow getTotalEquity sums net equity across all properties", async () => {
    const fake = makeFakePrisma();
    const mod = createRealestateModule({
      prismaService: { client: fake.client } as unknown as PrismaService,
    });
    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const p1 = await mod.service.createProperty(userId, {
      label: "P1",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    await mod.service.attachMortgage(userId, {
      propertyId: p1.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 600,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    await mod.service.createProperty(userId, {
      label: "P2",
      propertyType: "residence-principale",
      currentValuation: 400_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const out = await mod.service.getTotalEquity(userId);
    expect(out.totalEquityEur).toBe(70_000 + 400_000);
    expect(out.perProperty).toHaveLength(2);
  });
});
