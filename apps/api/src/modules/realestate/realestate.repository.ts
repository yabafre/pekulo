// apps/api/src/modules/realestate/realestate.repository.ts
// Prisma layer for the realestate domain (story 4-1).
//
// Discipline:
//   - Every query carries explicit where: { userId } (ADR-0013, defense in
//     depth). Single-row finds use where: { id, userId }; child finds use
//     where: { realEstateId, userId }. Lint rule pekulo/no-prisma-query-
//     without-user-id (story 0-12) gates this on every method below.
//   - recordValuation wraps real_estate.update + real_estate_valuations.create
//     in client.$transaction (ADR-0001 sister-table audit, mirrors 1-1
//     compass_history and 2-2 account_balance_log atomicity).
//   - deleteProperty relies on FK ON DELETE CASCADE (migration T1) — a single
//     deleteMany on the parent removes mortgage + rental + every valuation
//     row in one shot (DR-5 budget asserted by AC-7).
//   - Every Decimal column flows through decimalToNumber(value, fallback) from
//     apps/api/src/common/derive/decimal-to-number.ts (L24 — six fields:
//     currentValuation, outstandingPrincipal, annualRate, monthlyPayment,
//     monthlyRent, monthlyCharges). Inlining Number(decimal) = review fail.
//   - The `as unknown as Parameters<typeof tx.X.create>[0]["data"]` bridge on
//     every `create` is mandatory because Prisma's generated types require
//     `id` when the column has no @default — the prefixed-ids extension
//     injects it at runtime (story 2-1 / 3-1 outcome lesson).

import type {
  AttachMortgageInput,
  AttachRentalInput,
  CreatePropertyInput,
  DeletePropertyInput,
  DetachMortgageInput,
  DetachRentalInput,
  ListValuationsInput,
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  RecordValuationInput,
  UpdateMortgageInput,
  UpdateRentalInput,
} from "@pekulo/validators";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { ExtendedPrismaClient } from "../../database";

export type MortgageAttachOutcome =
  | { outcome: "ok"; mortgage: RealEstateMortgage }
  | { outcome: "duplicate" };

export type MortgageUpdateOutcome =
  | { outcome: "ok"; mortgage: RealEstateMortgage }
  | { outcome: "not-found" };

export type RentalAttachOutcome =
  | { outcome: "ok"; rental: RealEstateRental }
  | { outcome: "duplicate" };

export type RentalUpdateOutcome =
  | { outcome: "ok"; rental: RealEstateRental }
  | { outcome: "not-found" };

export type RecordValuationOutcome =
  | { outcome: "ok"; property: RealEstate }
  | { outcome: "not-found" };

export interface RealestateRepository {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  findByIdForUser(userId: string, propertyId: string): Promise<RealEstate | null>;
  listByUser(userId: string): Promise<RealEstate[]>;
  findMortgageForUser(userId: string, propertyId: string): Promise<RealEstateMortgage | null>;
  findRentalForUser(userId: string, propertyId: string): Promise<RealEstateRental | null>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<MortgageAttachOutcome>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<MortgageUpdateOutcome>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RentalAttachOutcome>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RentalUpdateOutcome>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RecordValuationOutcome>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
  listWithChildrenForUser(userId: string): Promise<
    Array<{
      property: RealEstate;
      mortgage: RealEstateMortgage | null;
      rental: RealEstateRental | null;
    }>
  >;
}

type PrismaPropertyRow = {
  id: string;
  userId: string;
  label: string;
  propertyType: string;
  currentValuation: unknown;
  lastValuedOn: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaMortgageRow = {
  id: string;
  userId: string;
  realEstateId: string;
  outstandingPrincipal: unknown;
  annualRate: unknown;
  monthlyPayment: unknown;
  termMonths: number;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaRentalRow = {
  id: string;
  userId: string;
  realEstateId: string;
  monthlyRent: unknown;
  monthlyCharges: unknown;
  furnished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaValuationRow = {
  id: string;
  userId: string;
  realEstateId: string;
  amount: unknown;
  valuedOn: Date;
  createdAt: Date;
};

function toProperty(row: PrismaPropertyRow): RealEstate {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    propertyType: row.propertyType as RealEstate["propertyType"],
    currentValuation: decimalToNumber(row.currentValuation, 0),
    lastValuedOn: row.lastValuedOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMortgage(row: PrismaMortgageRow): RealEstateMortgage {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    outstandingPrincipal: decimalToNumber(row.outstandingPrincipal, 0),
    annualRate: decimalToNumber(row.annualRate, 0),
    monthlyPayment: decimalToNumber(row.monthlyPayment, 0),
    termMonths: row.termMonths,
    startDate: row.startDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRental(row: PrismaRentalRow): RealEstateRental {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    monthlyRent: decimalToNumber(row.monthlyRent, 0),
    monthlyCharges: decimalToNumber(row.monthlyCharges, 0),
    furnished: row.furnished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toValuation(row: PrismaValuationRow): RealEstateValuation {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    amount: decimalToNumber(row.amount, 0),
    valuedOn: row.valuedOn,
    createdAt: row.createdAt,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export function createRealestateRepository(deps: {
  client: ExtendedPrismaClient;
}): RealestateRepository {
  const { client } = deps;

  return {
    async createProperty(userId, input) {
      const row = await client.realEstate.create({
        data: {
          userId,
          label: input.label,
          propertyType: input.propertyType,
          currentValuation: input.currentValuation,
          lastValuedOn: input.lastValuedOn,
        } as unknown as Parameters<typeof client.realEstate.create>[0]["data"],
      });
      return toProperty(row as unknown as PrismaPropertyRow);
    },

    async findByIdForUser(userId, propertyId) {
      const row = await client.realEstate.findFirst({
        where: { id: propertyId, userId },
      });
      return row ? toProperty(row as unknown as PrismaPropertyRow) : null;
    },

    async listByUser(userId) {
      const rows = await client.realEstate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => toProperty(r as unknown as PrismaPropertyRow));
    },

    async findMortgageForUser(userId, propertyId) {
      const row = await client.realEstateMortgage.findFirst({
        where: { realEstateId: propertyId, userId },
      });
      return row ? toMortgage(row as unknown as PrismaMortgageRow) : null;
    },

    async findRentalForUser(userId, propertyId) {
      const row = await client.realEstateRental.findFirst({
        where: { realEstateId: propertyId, userId },
      });
      return row ? toRental(row as unknown as PrismaRentalRow) : null;
    },

    async attachMortgage(userId, input) {
      try {
        const row = await client.realEstateMortgage.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            outstandingPrincipal: input.outstandingPrincipal,
            annualRate: input.annualRate,
            monthlyPayment: input.monthlyPayment,
            termMonths: input.termMonths,
            startDate: input.startDate,
          } as unknown as Parameters<typeof client.realEstateMortgage.create>[0]["data"],
        });
        return { outcome: "ok", mortgage: toMortgage(row as unknown as PrismaMortgageRow) };
      } catch (err) {
        if (isUniqueConstraintError(err)) return { outcome: "duplicate" };
        throw err;
      }
    },

    async updateMortgage(userId, input) {
      const data: Record<string, unknown> = {};
      if (input.outstandingPrincipal !== undefined)
        data.outstandingPrincipal = input.outstandingPrincipal;
      if (input.annualRate !== undefined) data.annualRate = input.annualRate;
      if (input.monthlyPayment !== undefined) data.monthlyPayment = input.monthlyPayment;
      if (input.termMonths !== undefined) data.termMonths = input.termMonths;
      if (input.startDate !== undefined) data.startDate = input.startDate;
      // updateMany + findFirst inside the same $transaction so a concurrent
      // detachMortgage cannot slip between the two queries (otherwise the
      // service would surface MORTGAGE_NOT_FOUND despite a successful update).
      return client.$transaction(async (tx) => {
        const res = await tx.realEstateMortgage.updateMany({
          where: { realEstateId: input.propertyId, userId },
          data,
        });
        if (res.count === 0) return { outcome: "not-found" } as const;
        const row = await tx.realEstateMortgage.findFirst({
          where: { realEstateId: input.propertyId, userId },
        });
        if (!row) return { outcome: "not-found" } as const;
        return {
          outcome: "ok",
          mortgage: toMortgage(row as unknown as PrismaMortgageRow),
        } as const;
      });
    },

    async detachMortgage(userId, input) {
      // Idempotent — { count: 0 | 1 } both surface as { ok: true } (AC-2).
      // TODO(observability): once apps/api ships per-handler attribute logs,
      // surface deleteMany's { count } so SRE can spot client double-detach
      // retry storms. Currently the rpc.request log only carries durationMs +
      // status; per-route attributes need a wider platform/http change.
      await client.realEstateMortgage.deleteMany({
        where: { realEstateId: input.propertyId, userId },
      });
      return { ok: true };
    },

    async attachRental(userId, input) {
      try {
        const row = await client.realEstateRental.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            monthlyRent: input.monthlyRent,
            monthlyCharges: input.monthlyCharges,
            furnished: input.furnished,
          } as unknown as Parameters<typeof client.realEstateRental.create>[0]["data"],
        });
        return { outcome: "ok", rental: toRental(row as unknown as PrismaRentalRow) };
      } catch (err) {
        if (isUniqueConstraintError(err)) return { outcome: "duplicate" };
        throw err;
      }
    },

    async updateRental(userId, input) {
      const data: Record<string, unknown> = {};
      if (input.monthlyRent !== undefined) data.monthlyRent = input.monthlyRent;
      if (input.monthlyCharges !== undefined) data.monthlyCharges = input.monthlyCharges;
      if (input.furnished !== undefined) data.furnished = input.furnished;
      // Wrap update + refetch in the same $transaction (concurrent detachRental
      // safety — see updateMortgage above).
      return client.$transaction(async (tx) => {
        const res = await tx.realEstateRental.updateMany({
          where: { realEstateId: input.propertyId, userId },
          data,
        });
        if (res.count === 0) return { outcome: "not-found" } as const;
        const row = await tx.realEstateRental.findFirst({
          where: { realEstateId: input.propertyId, userId },
        });
        if (!row) return { outcome: "not-found" } as const;
        return {
          outcome: "ok",
          rental: toRental(row as unknown as PrismaRentalRow),
        } as const;
      });
    },

    async detachRental(userId, input) {
      // Idempotent — see detachMortgage for the observability TODO.
      await client.realEstateRental.deleteMany({
        where: { realEstateId: input.propertyId, userId },
      });
      return { ok: true };
    },

    async recordValuation(userId, input) {
      // updateMany (not update) inside $transaction so a concurrent deleteProperty
      // races to a clean "not-found" outcome instead of leaking Prisma P2025 as
      // a 500 (AC-11 promises 404 for missing property under all conditions).
      return client.$transaction(async (tx) => {
        const res = await tx.realEstate.updateMany({
          where: { id: input.propertyId, userId },
          data: {
            currentValuation: input.amount,
            lastValuedOn: input.valuedOn,
          },
        });
        if (res.count === 0) return { outcome: "not-found" } as const;
        await tx.realEstateValuation.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            amount: input.amount,
            valuedOn: input.valuedOn,
          } as unknown as Parameters<typeof tx.realEstateValuation.create>[0]["data"],
        });
        const updatedRow = await tx.realEstate.findFirst({
          where: { id: input.propertyId, userId },
        });
        if (!updatedRow) return { outcome: "not-found" } as const;
        return {
          outcome: "ok",
          property: toProperty(updatedRow as unknown as PrismaPropertyRow),
        } as const;
      });
    },

    async listValuations(userId, input) {
      const rows = await client.realEstateValuation.findMany({
        where: { realEstateId: input.propertyId, userId },
        orderBy: { valuedOn: "desc" },
      });
      return rows.map((r) => toValuation(r as unknown as PrismaValuationRow));
    },

    async deleteProperty(userId, input) {
      // FK cascade removes mortgage + rental + valuations atomically (DR-5).
      await client.realEstate.deleteMany({ where: { id: input.id, userId } });
      return { ok: true };
    },

    async listWithChildrenForUser(userId) {
      const rows = await client.realEstate.findMany({
        where: { userId },
        include: { mortgage: true, rental: true },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) => {
        const r = row as unknown as PrismaPropertyRow & {
          mortgage: PrismaMortgageRow | null;
          rental: PrismaRentalRow | null;
        };
        return {
          property: toProperty(r),
          mortgage: r.mortgage ? toMortgage(r.mortgage) : null,
          rental: r.rental ? toRental(r.rental) : null,
        };
      });
    },
  };
}
