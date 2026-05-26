// apps/api/src/modules/monthly/monthly.module.ts
// Composition root for the monthly module (story 5-4). Mirrors
// hypothesis.module.ts — `createMonthlyModule(deps) → { service, router }`.
// Dependency list is `{ prismaService }` only: MonthlyRecord keys on
// (userId, year, monthNum) with the user-scoped where belt, and the derive
// reads transactions from the same Prisma client via the repository's
// listTransactionsForMonth method. No cross-aggregate probe needed.

import type { PrismaService } from "../../database";
import { createMonthlyRepository } from "./monthly.repository";
import { createMonthlyRouter } from "./monthly.routes";
import { createMonthlyService, type MonthlyService } from "./monthly.service";

export interface MonthlyModule {
  service: MonthlyService;
  router: ReturnType<typeof createMonthlyRouter>;
}

export function createMonthlyModule(deps: { prismaService: PrismaService }): MonthlyModule {
  const repository = createMonthlyRepository({ client: deps.prismaService.client });
  const service = createMonthlyService({ repository });
  const router = createMonthlyRouter({ service });
  return { service, router };
}
