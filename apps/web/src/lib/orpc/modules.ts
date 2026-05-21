// apps/web/src/lib/orpc/modules.ts
// Per-module typed oRPC clients. Each module's client infers its full
// request/response surface from the corresponding contract in @pekulo/contracts.
// Server actions in apps/web (added story by story) call e.g.
// `accountsClient.list({ ... })` and propagate the typed response.
//
// Only clients backed by a mounted apps/api router are exported. The api
// router today exposes 6 modules (see runtime-dependencies.ts):
// hypothesis, compass, milestones, accounts, holdings, realestate.
// Clients for contracts whose api route hasn't shipped yet (auth,
// transactions, monthly, dashboard, settings, llm) are added back as the
// corresponding story lands them server-side — keeping this file aligned
// with the actual route surface prevents accidental 404s on unmounted
// paths.
//
// 2026-05-09 — added the `{ path: [moduleKey] }` option to every
// `createORPCClient`. apps/api mounts each module under
// `/rpc/v1/<moduleKey>/<proc>` (see `orpc-mount.ts`); without the path
// option, the client builds URLs as `/rpc/v1/<proc>` (no module prefix)
// and apps/api 404s.

import "server-only";

import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import {
  compassContract,
  milestonesContract,
  accountsContract,
  holdingsContract,
  hypothesisContract,
  realestateContract,
} from "@pekulo/contracts";

import { orpcLink } from "./client";

export const compassClient: ContractRouterClient<typeof compassContract> = createORPCClient(
  orpcLink,
  { path: ["compass"] },
);
export const milestonesClient: ContractRouterClient<typeof milestonesContract> = createORPCClient(
  orpcLink,
  { path: ["milestones"] },
);
export const accountsClient: ContractRouterClient<typeof accountsContract> = createORPCClient(
  orpcLink,
  { path: ["accounts"] },
);
export const holdingsClient: ContractRouterClient<typeof holdingsContract> = createORPCClient(
  orpcLink,
  { path: ["holdings"] },
);
export const hypothesisClient: ContractRouterClient<typeof hypothesisContract> = createORPCClient(
  orpcLink,
  { path: ["hypothesis"] },
);
export const realestateClient: ContractRouterClient<typeof realestateContract> = createORPCClient(
  orpcLink,
  { path: ["realestate"] },
);
