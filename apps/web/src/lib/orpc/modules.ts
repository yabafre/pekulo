// apps/web/src/lib/orpc/modules.ts
// Per-module typed oRPC clients. Each module's client infers its full
// request/response surface from the corresponding contract in @pekulo/contracts.
// Server actions in apps/web (added story by story) call e.g.
// `accountsClient.list({ ... })` and propagate the typed response.

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

export const authClient: ContractRouterClient<typeof authContract> = createORPCClient(orpcLink);
export const compassClient: ContractRouterClient<typeof compassContract> = createORPCClient(orpcLink);
export const milestonesClient: ContractRouterClient<typeof milestonesContract> = createORPCClient(orpcLink);
export const accountsClient: ContractRouterClient<typeof accountsContract> = createORPCClient(orpcLink);
export const holdingsClient: ContractRouterClient<typeof holdingsContract> = createORPCClient(orpcLink);
export const realestateClient: ContractRouterClient<typeof realestateContract> = createORPCClient(orpcLink);
export const transactionsClient: ContractRouterClient<typeof transactionsContract> = createORPCClient(orpcLink);
export const monthlyClient: ContractRouterClient<typeof monthlyContract> = createORPCClient(orpcLink);
export const dashboardClient: ContractRouterClient<typeof dashboardContract> = createORPCClient(orpcLink);
export const settingsClient: ContractRouterClient<typeof settingsContract> = createORPCClient(orpcLink);
export const hypothesisClient: ContractRouterClient<typeof hypothesisContract> = createORPCClient(orpcLink);
export const llmClient: ContractRouterClient<typeof llmContract> = createORPCClient(orpcLink);
