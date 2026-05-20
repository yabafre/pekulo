// apps/api/src/test/fakes/fake-realestate.ts
// In-memory Prisma fake modelling the 4 real-estate tables (story 4-1).
// Provides $transaction support (sync callback wrapper — atomicity isn't
// observable in unit tests, but the API surface must match Prisma's actual
// shape so the repository compiles against it). Mirrors the in-line fakes
// in holdings.repository.test.ts (cast at the boundary via
// `as unknown as ExtendedPrismaClient`) — factored out because realestate
// tests span repo + service + module + integration files.

import type { ExtendedPrismaClient } from "../../database";

type RealEstateRow = {
  id: string;
  userId: string;
  label: string;
  propertyType: string;
  currentValuation: { toNumber: () => number };
  lastValuedOn: Date;
  createdAt: Date;
  updatedAt: Date;
};

type MortgageRow = {
  id: string;
  userId: string;
  realEstateId: string;
  outstandingPrincipal: { toNumber: () => number };
  annualRate: { toNumber: () => number };
  monthlyPayment: { toNumber: () => number };
  termMonths: number;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type RentalRow = {
  id: string;
  userId: string;
  realEstateId: string;
  monthlyRent: { toNumber: () => number };
  monthlyCharges: { toNumber: () => number };
  furnished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ValuationRow = {
  id: string;
  userId: string;
  realEstateId: string;
  amount: { toNumber: () => number };
  valuedOn: Date;
  createdAt: Date;
};

const dec = (n: number) => ({ toNumber: () => n });
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const id = (prefix: string) =>
  `${prefix}_${Array.from({ length: 21 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("")}`;

export function makeFakePrisma() {
  const real_estate: RealEstateRow[] = [];
  const real_estate_mortgage: MortgageRow[] = [];
  const real_estate_rental: RentalRow[] = [];
  const real_estate_valuations: ValuationRow[] = [];

  const tableLike = {
    realEstate: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          label: string;
          propertyType: string;
          currentValuation: number;
          lastValuedOn: Date;
          id?: string;
        };
      }) => {
        const row: RealEstateRow = {
          id: data.id ?? id("res"),
          userId: data.userId,
          label: data.label,
          propertyType: data.propertyType,
          currentValuation: dec(data.currentValuation),
          lastValuedOn: data.lastValuedOn,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        real_estate.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
      findMany: async ({ where }: { where: { userId: string }; orderBy?: unknown }) =>
        real_estate.filter((r) => r.userId === where.userId),
      update: async ({
        where,
        data,
      }: {
        where: { id: string; userId: string };
        data: { currentValuation?: number; lastValuedOn?: Date };
      }) => {
        const row = real_estate.find((r) => r.id === where.id && r.userId === where.userId);
        if (!row) throw new Error("not found");
        if (data.currentValuation !== undefined) row.currentValuation = dec(data.currentValuation);
        if (data.lastValuedOn !== undefined) row.lastValuedOn = data.lastValuedOn;
        row.updatedAt = new Date();
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; userId: string };
        data: { currentValuation?: number; lastValuedOn?: Date };
      }) => {
        const row = real_estate.find((r) => r.id === where.id && r.userId === where.userId);
        if (!row) return { count: 0 };
        if (data.currentValuation !== undefined) row.currentValuation = dec(data.currentValuation);
        if (data.lastValuedOn !== undefined) row.lastValuedOn = data.lastValuedOn;
        row.updatedAt = new Date();
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        const idx = real_estate.findIndex((r) => r.id === where.id && r.userId === where.userId);
        if (idx === -1) return { count: 0 };
        const removedId = real_estate[idx]!.id;
        real_estate.splice(idx, 1);
        // Simulate FK cascade.
        for (let i = real_estate_mortgage.length - 1; i >= 0; i--) {
          if (real_estate_mortgage[i]!.realEstateId === removedId) {
            real_estate_mortgage.splice(i, 1);
          }
        }
        for (let i = real_estate_rental.length - 1; i >= 0; i--) {
          if (real_estate_rental[i]!.realEstateId === removedId) {
            real_estate_rental.splice(i, 1);
          }
        }
        for (let i = real_estate_valuations.length - 1; i >= 0; i--) {
          if (real_estate_valuations[i]!.realEstateId === removedId) {
            real_estate_valuations.splice(i, 1);
          }
        }
        return { count: 1 };
      },
    },
    realEstateMortgage: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          realEstateId: string;
          outstandingPrincipal: number;
          annualRate: number;
          monthlyPayment: number;
          termMonths: number;
          startDate: Date;
          id?: string;
        };
      }) => {
        if (real_estate_mortgage.find((m) => m.realEstateId === data.realEstateId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row: MortgageRow = {
          id: data.id ?? id("resm"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          outstandingPrincipal: dec(data.outstandingPrincipal),
          annualRate: dec(data.annualRate),
          monthlyPayment: dec(data.monthlyPayment),
          termMonths: data.termMonths,
          startDate: data.startDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate_mortgage.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { realEstateId: string; userId: string } }) =>
        real_estate_mortgage.find(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { realEstateId: string; userId: string };
        data: Partial<{
          outstandingPrincipal: number;
          annualRate: number;
          monthlyPayment: number;
          termMonths: number;
          startDate: Date;
        }>;
      }) => {
        const row = real_estate_mortgage.find(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        );
        if (!row) return { count: 0 };
        if (data.outstandingPrincipal !== undefined)
          row.outstandingPrincipal = dec(data.outstandingPrincipal);
        if (data.annualRate !== undefined) row.annualRate = dec(data.annualRate);
        if (data.monthlyPayment !== undefined) row.monthlyPayment = dec(data.monthlyPayment);
        if (data.termMonths !== undefined) row.termMonths = data.termMonths;
        if (data.startDate !== undefined) row.startDate = data.startDate;
        row.updatedAt = new Date();
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { realEstateId: string; userId: string } }) => {
        const idx = real_estate_mortgage.findIndex(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        );
        if (idx === -1) return { count: 0 };
        real_estate_mortgage.splice(idx, 1);
        return { count: 1 };
      },
    },
    realEstateRental: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          realEstateId: string;
          monthlyRent: number;
          monthlyCharges: number;
          furnished: boolean;
          id?: string;
        };
      }) => {
        if (real_estate_rental.find((r) => r.realEstateId === data.realEstateId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row: RentalRow = {
          id: data.id ?? id("resr"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          monthlyRent: dec(data.monthlyRent),
          monthlyCharges: dec(data.monthlyCharges),
          furnished: data.furnished,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate_rental.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { realEstateId: string; userId: string } }) =>
        real_estate_rental.find(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { realEstateId: string; userId: string };
        data: Partial<{ monthlyRent: number; monthlyCharges: number; furnished: boolean }>;
      }) => {
        const row = real_estate_rental.find(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        );
        if (!row) return { count: 0 };
        if (data.monthlyRent !== undefined) row.monthlyRent = dec(data.monthlyRent);
        if (data.monthlyCharges !== undefined) row.monthlyCharges = dec(data.monthlyCharges);
        if (data.furnished !== undefined) row.furnished = data.furnished;
        row.updatedAt = new Date();
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { realEstateId: string; userId: string } }) => {
        const idx = real_estate_rental.findIndex(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        );
        if (idx === -1) return { count: 0 };
        real_estate_rental.splice(idx, 1);
        return { count: 1 };
      },
    },
    realEstateValuation: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          realEstateId: string;
          amount: number;
          valuedOn: Date;
          id?: string;
        };
      }) => {
        const row: ValuationRow = {
          id: data.id ?? id("resv"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          amount: dec(data.amount),
          valuedOn: data.valuedOn,
          createdAt: new Date(),
        };
        real_estate_valuations.push(row);
        return row;
      },
      findMany: async ({
        where,
      }: {
        where: { realEstateId: string; userId: string };
        orderBy?: unknown;
      }) =>
        real_estate_valuations
          .filter((v) => v.realEstateId === where.realEstateId && v.userId === where.userId)
          .sort((a, b) => b.valuedOn.getTime() - a.valuedOn.getTime()),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async $transaction<T>(cb: (tx: any) => Promise<T>): Promise<T> {
      return cb(tableLike);
    },
  };

  return { client: tableLike as unknown as ExtendedPrismaClient };
}

export type FakeRealestateClient = ReturnType<typeof makeFakePrisma>["client"];
