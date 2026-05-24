// apps/api/src/modules/transactions/transactions.module.ts
// Composition root for the transactions module (story 5-1). Mirrors
// realestate.module.ts shape — `createXxxModule(deps) → { service, router }`.
// The AccountOwnershipProbe dep is the narrow cross-aggregate interface the
// runtime composition root (bootstrap/runtime-dependencies.ts) wraps around
// accountsModule.service.accountExists — keeps L1 conformance (no
// AccountsRepository type leak across modules).

import type { PrismaService } from "../../database";
import { createTransactionsRepository } from "./transactions.repository";
import { createTransactionsRouter } from "./transactions.routes";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type TransactionsService,
} from "./transactions.service";

export interface TransactionsModule {
  service: TransactionsService;
  router: ReturnType<typeof createTransactionsRouter>;
}

export function createTransactionsModule(deps: {
  prismaService: PrismaService;
  accountOwnershipProbe: AccountOwnershipProbe;
}): TransactionsModule {
  const repository = createTransactionsRepository({ client: deps.prismaService.client });
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
  });
  const router = createTransactionsRouter({ service });
  return { service, router };
}
