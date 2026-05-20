// apps/api/src/modules/realestate/realestate.service.ts
// Business logic for the realestate module (story 4-1). Owns:
//   - cross-aggregate guard via repository.findByIdForUser BEFORE every
//     mutation (mirrors story 3-1 findAccountForUser — yields a clean 404
//     instead of leaking RLS P2025).
//   - outcome-to-error translation per discriminated repo returns:
//       MortgageAttachOutcome.duplicate → mortgageAlreadyAttached()
//       MortgageUpdateOutcome.not-found → mortgageNotFound()
//       (same for rental)
//   - idempotency on detach* — { ok: true } regardless of child presence.
//   - getProperty composes property + 1:1 mortgage + 1:1 rental into the
//     PropertyWithChildren shape declared in @pekulo/validators (T13 contract).

import type {
  AttachMortgageInput,
  AttachRentalInput,
  CreatePropertyInput,
  DeletePropertyInput,
  DetachMortgageInput,
  DetachRentalInput,
  GetPropertyInput,
  ListValuationsInput,
  PropertyWithChildren,
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  RecordValuationInput,
  UpdateMortgageInput,
  UpdateRentalInput,
} from "@pekulo/validators";
import {
  mortgageAlreadyAttached,
  mortgageNotFound,
  realestateNotFound,
  rentalAlreadyAttached,
  rentalNotFound,
} from "./realestate.errors";
import type { RealestateRepository } from "./realestate.repository";

export interface RealestateService {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  getProperty(userId: string, input: GetPropertyInput): Promise<PropertyWithChildren>;
  listProperties(userId: string): Promise<RealEstate[]>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<RealEstateMortgage>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<RealEstateMortgage>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RealEstateRental>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RealEstateRental>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
}

export function createRealestateService(deps: {
  repository: RealestateRepository;
}): RealestateService {
  const { repository } = deps;

  async function requireOwnedProperty(userId: string, propertyId: string): Promise<void> {
    const exists = await repository.findByIdForUser(userId, propertyId);
    if (!exists) throw realestateNotFound();
  }

  return {
    async createProperty(userId, input) {
      return repository.createProperty(userId, input);
    },

    async getProperty(userId, input) {
      const property = await repository.findByIdForUser(userId, input.id);
      if (!property) throw realestateNotFound();
      const [mortgage, rental] = await Promise.all([
        repository.findMortgageForUser(userId, input.id),
        repository.findRentalForUser(userId, input.id),
      ]);
      return { property, mortgage, rental };
    },

    async listProperties(userId) {
      return repository.listByUser(userId);
    },

    async attachMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await repository.attachMortgage(userId, input);
      if (result.outcome === "duplicate") throw mortgageAlreadyAttached();
      return result.mortgage;
    },

    async updateMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await repository.updateMortgage(userId, input);
      if (result.outcome === "not-found") throw mortgageNotFound();
      return result.mortgage;
    },

    async detachMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return repository.detachMortgage(userId, input);
    },

    async attachRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await repository.attachRental(userId, input);
      if (result.outcome === "duplicate") throw rentalAlreadyAttached();
      return result.rental;
    },

    async updateRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await repository.updateRental(userId, input);
      if (result.outcome === "not-found") throw rentalNotFound();
      return result.rental;
    },

    async detachRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return repository.detachRental(userId, input);
    },

    async recordValuation(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await repository.recordValuation(userId, input);
      // "not-found" only reachable via concurrent deleteProperty between guard
      // and transaction — the repo uses updateMany inside $transaction so we
      // never leak Prisma P2025 as 500 (AC-11 contract).
      if (result.outcome === "not-found") throw realestateNotFound();
      return result.property;
    },

    async listValuations(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return repository.listValuations(userId, input);
    },

    async deleteProperty(userId, input) {
      await requireOwnedProperty(userId, input.id);
      return repository.deleteProperty(userId, input);
    },
  };
}
