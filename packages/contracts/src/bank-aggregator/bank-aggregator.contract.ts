// packages/contracts/src/bank-aggregator/bank-aggregator.contract.ts
// Bank-aggregator oRPC contract (story 5-6 + ADR-0015). 4 procedures mounted under
// /rpc/v1/bankaggregator (lowercase, no separator — uniform with /realestate).
//
// Typed-error declarations mirror realestate.contract.ts (story 4-1) — each
// error surfaces on the wire as the canonical { code, status, message }
// envelope so the apps/web zapaction bridge narrows on `code`.

import { oc } from "@orpc/contract";
import {
  completeConnectionInputSchema,
  completeConnectionOutputSchema,
  initiateConnectionInputSchema,
  initiateConnectionOutputSchema,
  listConnectionsOutputSchema,
  refreshConnectionInputSchema,
  refreshConnectionOutputSchema,
} from "@pekulo/validators";

const bankConnectionNotFoundError = {
  status: 404 as const,
  message: "bank connection not found",
};
const bankConnectionAlreadyExistsError = {
  status: 409 as const,
  message: "bank connection already exists for this item",
};
const bankConnectionRevokedError = {
  status: 409 as const,
  message: "bank connection is revoked — re-initiate via initiateConnection",
};
const bankProviderUnavailableError = {
  status: 503 as const,
  message: "bank provider unavailable",
};
const bankScaRequiredError = {
  status: 409 as const,
  message: "SCA refresh required — user must reconnect",
};
const rateLimitedError = {
  status: 429 as const,
  message: "rate limit exceeded — retry in 60s",
};

export const bankAggregatorContractV1 = {
  initiateConnection: oc
    .errors({ BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError })
    .input(initiateConnectionInputSchema)
    .output(initiateConnectionOutputSchema),

  completeConnection: oc
    .errors({
      BANK_CONNECTION_ALREADY_EXISTS: bankConnectionAlreadyExistsError,
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
    })
    .input(completeConnectionInputSchema)
    .output(completeConnectionOutputSchema),

  listConnections: oc.output(listConnectionsOutputSchema),

  refreshConnection: oc
    .errors({
      BANK_CONNECTION_NOT_FOUND: bankConnectionNotFoundError,
      BANK_CONNECTION_REVOKED: bankConnectionRevokedError,
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
      BANK_SCA_REQUIRED: bankScaRequiredError,
      RATE_LIMITED: rateLimitedError,
    })
    .input(refreshConnectionInputSchema)
    .output(refreshConnectionOutputSchema),
} as const;

export const bankAggregatorContract = bankAggregatorContractV1;
export const bankAggregatorContractMeta = {
  moduleKey: "bankaggregator",
  mountPath: "/rpc/v1/bankaggregator",
  version: "v1",
} as const;
