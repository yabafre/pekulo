// Business logic for the holdings domain.
//
// Translation rules:
//   - create: probe findAccountForUser → throw AccountError("ACCOUNT_NOT_FOUND")
//     on missing/cross-user.
//   - close: returns { ok: true } whether the repository reports 'closed' or
//     'already-closed' (idempotent close — no error on second call). On
//     'not-found', throw HoldingError("HOLDING_NOT_FOUND").
//   - recordLot: probe findByIdForUser → throw HoldingError("HOLDING_NOT_FOUND")
//     on missing/cross-user, then HoldingError("HOLDING_CLOSED") if closedAt
//     is non-null, then delegate to repository.
//   - getDerived: probe findByIdForUser → throw HoldingError("HOLDING_NOT_FOUND")
//     on missing/cross-user, fetch lots via findLotsByHoldingForUser, run
//     deriveFromLots; if the result is { 0, 0 } AND lots.length === 0, fall
//     back to the row's manually-entered { quantity, avgCost } and tag the
//     output source as 'manual'; otherwise source 'lots'.
//   - list: delegate to repository with the includeClosed flag.

import type {
  CloseHoldingInput,
  CloseHoldingOutput,
  CreateHoldingInput,
  DerivedHolding,
  GetDerivedHoldingInput,
  Holding,
  HoldingLot,
  ListHoldingsInput,
  RecordLotInput,
} from "@pekulo/validators";
import { deriveFromLots } from "../../common/derive/holding-quantity";
import { accountNotFound } from "../accounts/accounts.errors";
import { holdingClosed, holdingNotFound } from "./holdings.errors";
import type { HoldingRepository } from "./holdings.repository";

export interface HoldingService {
  create(userId: string, input: CreateHoldingInput): Promise<Holding>;
  recordLot(userId: string, input: RecordLotInput): Promise<HoldingLot>;
  close(userId: string, input: CloseHoldingInput): Promise<CloseHoldingOutput>;
  list(userId: string, input: ListHoldingsInput): Promise<Holding[]>;
  getDerived(userId: string, input: GetDerivedHoldingInput): Promise<DerivedHolding>;
}

export interface HoldingServiceDeps {
  repository: HoldingRepository;
}

export function createHoldingService(deps: HoldingServiceDeps): HoldingService {
  return {
    async create(userId, input) {
      const account = await deps.repository.findAccountForUser(userId, input.accountId);
      if (!account) throw accountNotFound();
      return deps.repository.create(userId, input);
    },

    async recordLot(userId, input) {
      const parent = await deps.repository.findByIdForUser(userId, input.holdingId);
      if (!parent) throw holdingNotFound();
      if (parent.closedAt !== null) throw holdingClosed();
      return deps.repository.recordLot(userId, input);
    },

    async close(userId, input) {
      const out = await deps.repository.close(userId, input.id);
      if (out.outcome === "not-found") throw holdingNotFound();
      return { ok: true } as const;
    },

    async list(userId, input) {
      return deps.repository.listByUser(userId, { includeClosed: input.includeClosed });
    },

    async getDerived(userId, input) {
      const parent = await deps.repository.findByIdForUser(userId, input.id);
      if (!parent) throw holdingNotFound();
      const lots = await deps.repository.findLotsByHoldingForUser(userId, input.id);
      const derived = deriveFromLots(lots);
      if (lots.length === 0) {
        return {
          holdingId: parent.id,
          quantity: parent.quantity,
          avgCost: parent.avgCost,
          source: "manual",
        } as const;
      }
      return {
        holdingId: parent.id,
        quantity: derived.quantity,
        avgCost: derived.avgCost,
        source: "lots",
      } as const;
    },
  };
}
