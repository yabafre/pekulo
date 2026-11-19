// apps/mobile/lib/orpc/modules.ts
// Per-module typed oRPC clients for apps/mobile. Mirrors apps/web/src/lib/orpc/modules.ts
// (R5 — only modules mounted in apps/api/src/bootstrap/runtime-dependencies.ts)
// without the web-only `import "server-only"` guard.

import { createORPCClient } from "@orpc/client";
import type { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import {
  accountsContract,
  bankAggregatorContract,
  compassContract,
  dashboardContract,
  holdingsContract,
  hypothesisContract,
  llmContract,
  milestonesContract,
  monthlyContract,
  realestateContract,
  settingsContract,
  transactionsContract,
} from "@pekulo/contracts";

import { orpcLink } from "./client";

export function createMobileOrpcClients(link: RPCLink<object> = orpcLink) {
  return {
    compassClient: createORPCClient(link, {
      path: ["compass"],
    }) as ContractRouterClient<typeof compassContract>,
    milestonesClient: createORPCClient(link, {
      path: ["milestones"],
    }) as ContractRouterClient<typeof milestonesContract>,
    accountsClient: createORPCClient(link, {
      path: ["accounts"],
    }) as ContractRouterClient<typeof accountsContract>,
    holdingsClient: createORPCClient(link, {
      path: ["holdings"],
    }) as ContractRouterClient<typeof holdingsContract>,
    hypothesisClient: createORPCClient(link, {
      path: ["hypothesis"],
    }) as ContractRouterClient<typeof hypothesisContract>,
    realestateClient: createORPCClient(link, {
      path: ["realestate"],
    }) as ContractRouterClient<typeof realestateContract>,
    transactionsClient: createORPCClient(link, {
      path: ["transactions"],
    }) as ContractRouterClient<typeof transactionsContract>,
    monthlyClient: createORPCClient(link, {
      path: ["monthly"],
    }) as ContractRouterClient<typeof monthlyContract>,
    bankAggregatorClient: createORPCClient(link, {
      path: ["bankaggregator"],
    }) as ContractRouterClient<typeof bankAggregatorContract>,
    llmClient: createORPCClient(link, {
      path: ["llm"],
    }) as ContractRouterClient<typeof llmContract>,
    dashboardClient: createORPCClient(link, {
      path: ["dashboard"],
    }) as ContractRouterClient<typeof dashboardContract>,
    settingsClient: createORPCClient(link, {
      path: ["settings"],
    }) as ContractRouterClient<typeof settingsContract>,
  };
}

const defaultClients = createMobileOrpcClients();

export const compassClient = defaultClients.compassClient;
export const milestonesClient = defaultClients.milestonesClient;
export const accountsClient = defaultClients.accountsClient;
export const holdingsClient = defaultClients.holdingsClient;
export const hypothesisClient = defaultClients.hypothesisClient;
export const realestateClient = defaultClients.realestateClient;
export const transactionsClient = defaultClients.transactionsClient;
export const monthlyClient = defaultClients.monthlyClient;
export const bankAggregatorClient = defaultClients.bankAggregatorClient;
export const llmClient = defaultClients.llmClient;
export const dashboardClient = defaultClients.dashboardClient;
export const settingsClient = defaultClients.settingsClient;
