// Module factory wiring repository + service + router for the accounts
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 (story 2-1 explicit): the router type is inferred via
// ReturnType<typeof createAccountsRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.
//
// The FK-probe + delete atomicity is handled inside the repository (see
// accounts.repository.ts#deleteWithFkProbe). The module factory stays trivial
// — no runTx indirection, no tx-scoped repo rebuild.

import type { PrismaService } from "../../database";
import { createAccountRepository } from "./accounts.repository";
import { createAccountService, type AccountService } from "./accounts.service";
import { createAccountsRouter } from "./accounts.routes";

export interface AccountsModule {
  service: AccountService;
  router: ReturnType<typeof createAccountsRouter>;
}

export function createAccountsModule(deps: { prismaService: PrismaService }): AccountsModule {
  const repository = createAccountRepository({ client: deps.prismaService.client });
  const service = createAccountService({ repository });
  const router = createAccountsRouter({ service });
  return { service, router };
}
