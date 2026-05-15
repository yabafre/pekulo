// apps/web/src/lib/orpc/modules.ts
// Per-module typed oRPC clients. Each module's client infers its full
// request/response surface from the corresponding contract in @pekulo/contracts.
// Server actions in apps/web (added story by story) call e.g.
// `accountsClient.list({ ... })` and propagate the typed response.
//
// 2026-05-09 — added the `{ path: [moduleKey] }` option to every
// `createORPCClient`. apps/api mounts each module under
// `/rpc/v1/<moduleKey>/<proc>` (see `orpc-mount.ts`); without the path
// option, the client builds URLs as `/rpc/v1/<proc>` (no module prefix)
// and apps/api 404s. This was a latent bug — the per-module clients had
// only ever been *imported*, never actually invoked end-to-end before
// story 1-4's dashboard wiring.

import "server-only";

import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import {
  authContract,
  compassContract,
  milestonesContract,
  accountsContract,
  holdingsContract,
  realestateContract,
  transactionsContract,
  monthlyContract,
  dashboardContract,
  settingsContract,
  hypothesisContract,
  llmContract,
} from "@pekulo/contracts";

import { orpcLink } from "./client";

export const authClient: ContractRouterClient<typeof authContract> = createORPCClient(orpcLink, {
  path: ["auth"],
});
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
export const realestateClient: ContractRouterClient<typeof realestateContract> = createORPCClient(
  orpcLink,
  { path: ["realestate"] },
);
export const transactionsClient: ContractRouterClient<typeof transactionsContract> =
  createORPCClient(orpcLink, { path: ["transactions"] });
export const monthlyClient: ContractRouterClient<typeof monthlyContract> = createORPCClient(
  orpcLink,
  { path: ["monthly"] },
);
export const dashboardClient: ContractRouterClient<typeof dashboardContract> = createORPCClient(
  orpcLink,
  { path: ["dashboard"] },
);
export const settingsClient: ContractRouterClient<typeof settingsContract> = createORPCClient(
  orpcLink,
  { path: ["settings"] },
);
export const hypothesisClient: ContractRouterClient<typeof hypothesisContract> = createORPCClient(
  orpcLink,
  { path: ["hypothesis"] },
);
export const llmClient: ContractRouterClient<typeof llmContract> = createORPCClient(orpcLink, {
  path: ["llm"],
});
