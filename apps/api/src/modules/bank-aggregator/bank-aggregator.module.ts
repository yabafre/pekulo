// apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts
// Composition root for the bank-aggregator module (story 5-6).
//
// Wires repository + provider + service + router + webhookRouter +
// scheduledTask. Cross-aggregate deps (TransactionsService + AccountService)
// are injected by the runtime composition layer (runtime-dependencies.ts in
// T23) so the module stays test-friendly.

import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import type { AccountService } from "../accounts/accounts.service";
import type { TransactionsService } from "../transactions/transactions.service";
import type { BankProvider } from "./bank-provider";
import type { LogosService } from "../logos/logos.service";
import { createBankAggregatorRepository } from "./bank-aggregator.repository";
import { createBankAggregatorRouter } from "./bank-aggregator.routes";
import { createBankAggregatorService } from "./bank-aggregator.service";
import { createBridgeProvider } from "./services/bridge-client";
import { createBridgeWebhookRouter } from "./services/bridge-webhook-router";
import { createRefreshScheduler } from "./services/refresh-scheduler";

export function createBankAggregatorModule(deps: {
  prismaService: PrismaService;
  env: Env;
  transactionsService: TransactionsService;
  accountsService: AccountService;
  clock?: () => Date;
  // Story 6-10 — injectable so logos + bank-aggregator share ONE Bridge
  // provider (breaks the logos↔provider↔bank-aggregator cycle). Defaults to an
  // internal provider so existing unit tests construct the module unchanged.
  provider?: BankProvider;
  // Story 6-10 — optional logo cache warm port (bank refresh + backfill).
  logos?: Pick<LogosService, "warmMany">;
}) {
  const repository = createBankAggregatorRepository({ prismaService: deps.prismaService });
  const provider = deps.provider ?? createBridgeProvider({ env: deps.env });
  const service = createBankAggregatorService({
    repository,
    provider,
    transactionsService: deps.transactionsService,
    accountsService: deps.accountsService,
    clock: deps.clock,
    logos: deps.logos,
    listAllActiveConnections: async () => {
      // Cross-user by design — the cron scheduler iterates ALL active
      // connections across users. RLS in the DB still applies (service-role
      // bypass + per-user RLS on bank_connections, ADR-0013); this lint rule
      // gates user-scoped queries, which doesn't apply to the scheduler path.
      // oxlint-disable-next-line pekulo/no-prisma-query-without-user-id -- scheduler cross-user iteration
      const rows = (await deps.prismaService.client.bankConnection.findMany({
        where: { status: "active" },
        select: { id: true, userId: true },
      })) as Array<{ id: string; userId: string }>;
      return rows.map((r) => ({ userId: r.userId, connectionId: r.id }));
    },
  });
  const router = createBankAggregatorRouter({ service });
  const webhookRouter = createBridgeWebhookRouter({ env: deps.env, service });
  const scheduledTask = createRefreshScheduler({ env: deps.env, service });
  return { service, repository, router, webhookRouter, scheduledTask };
}
