// packages/contracts/src/holdings.contract.ts
// Holdings module oRPC contract. Five procedures:
//   - create: insert a holding; returns the new Holding row.
//   - recordLot: insert a lot row; returns the new HoldingLot row.
//   - close: mark a holding as closed; returns { ok: true } (idempotent).
//   - list: read holdings for the user; { includeClosed } filter (default false).
//   - getDerived: compute (quantity, avgCost) from lots, fall back to row
//     values on zero-lot.
// See ADR-0009 (mount under /rpc/v1/holdings).
//
// Declared errors propagate as typed `defined` ORPCError instances on the
// client. `isDefinedError(err)` returns true when the wire JSON's `code`
// matches a declared entry — the web SAs can then narrow `err.code` with
// full TS safety. Status codes mirror ORPC_HTTP_STATUS_BY_CODE.

import { oc } from "@orpc/contract";
import {
  closeHoldingInputSchema,
  closeHoldingOutputSchema,
  createHoldingInputSchema,
  derivedHoldingSchema,
  getDerivedHoldingInputSchema,
  holdingLotSchema,
  holdingSchema,
  listHoldingsInputSchema,
  listHoldingsOutputSchema,
  recordLotInputSchema,
} from "@pekulo/validators";

const holdingNotFoundError = {
  status: 404 as const,
  message: "holding not found",
};

const holdingClosedError = {
  status: 409 as const,
  message: "holding is closed",
};

const accountNotFoundError = {
  status: 404 as const,
  message: "account not found",
};

export const holdingsContractV1 = {
  create: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(createHoldingInputSchema)
    .output(holdingSchema),
  recordLot: oc
    .errors({
      HOLDING_NOT_FOUND: holdingNotFoundError,
      HOLDING_CLOSED: holdingClosedError,
    })
    .input(recordLotInputSchema)
    .output(holdingLotSchema),
  close: oc
    .errors({ HOLDING_NOT_FOUND: holdingNotFoundError })
    .input(closeHoldingInputSchema)
    .output(closeHoldingOutputSchema),
  list: oc.input(listHoldingsInputSchema).output(listHoldingsOutputSchema),
  getDerived: oc
    .errors({ HOLDING_NOT_FOUND: holdingNotFoundError })
    .input(getDerivedHoldingInputSchema)
    .output(derivedHoldingSchema),
} as const;

export const holdingsContract = holdingsContractV1;
export const holdingsContractMeta = {
  moduleKey: "holdings",
  mountPath: "/rpc/v1/holdings",
  version: "v1",
} as const;
