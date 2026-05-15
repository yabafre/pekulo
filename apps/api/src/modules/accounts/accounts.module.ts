// Module factory wiring repository + service + router for the accounts
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 (story 2-1 explicit): the router type is inferred via
// ReturnType<typeof createAccountsRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.
//
// The service's runTx callback closes over prismaService.client.$transaction.
// Inside the callback we build a tx-scoped repository so the FK probe and the
// delete both run against the same transaction (TOCTOU avoidance, mirrors
// milestones#addEnforcingCap).

import type { PrismaService } from "../../database";
import { createAccountRepository, type AccountRepository } from "./accounts.repository";
import { createAccountService, type AccountService } from "./accounts.service";
import { createAccountsRouter } from "./accounts.routes";

export interface AccountsModule {
  service: AccountService;
  router: ReturnType<typeof createAccountsRouter>;
}

export function createAccountsModule(deps: { prismaService: PrismaService }): AccountsModule {
  const repository = createAccountRepository({ client: deps.prismaService.client });
  const service = createAccountService({
    repository,
    async runTx<T>(fn: (tx: AccountRepository) => Promise<T>): Promise<T> {
      return deps.prismaService.client.$transaction(async (tx) =>
        fn(
          createAccountRepository({
            client: tx as unknown as typeof deps.prismaService.client,
          }),
        ),
      );
    },
  });
  const router = createAccountsRouter({ service });
  return { service, router };
}
