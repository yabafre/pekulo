import type { CompassReader, MilestonePresenceProbe, WealthHistoryProvider } from "@pekulo/types";
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createAccountsModule } from "../modules/accounts/accounts.module";
import { createCompassModule } from "../modules/compass/compass.module";
import { createHoldingsModule } from "../modules/holdings/holdings.module";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createMilestonesModule } from "../modules/milestones/milestones.module";
import { createRealestateModule } from "../modules/realestate/realestate.module";
import { createTransactionsModule } from "../modules/transactions/transactions.module";
import { decimalToNumber } from "../common/derive/decimal-to-number";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
  orpcRouter: PekuloRpcRouter;
  milestonePresenceProbe: MilestonePresenceProbe;
}

// F10 (carry-over from 0-3): single transient probe failure should not yank
// traffic. Track consecutive failures and only flip ok:false after two in a
// row.
const PRISMA_PROBE_FAILURE_THRESHOLD = 2;

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

  let consecutivePrismaFailures = 0;
  readiness.register("prisma", async () => {
    try {
      await prismaService.client.$queryRaw`SELECT 1`;
      consecutivePrismaFailures = 0;
      return { ok: true };
    } catch (err) {
      consecutivePrismaFailures += 1;
      const reason = err instanceof Error ? err.message : String(err);
      if (consecutivePrismaFailures < PRISMA_PROBE_FAILURE_THRESHOLD) {
        return { ok: true, reason: `prisma transient (${reason})` };
      }
      return {
        ok: false,
        reason: `prisma down (${consecutivePrismaFailures} consecutive): ${reason}`,
      };
    }
  });

  const jwtVerifier = createJwtVerifier({
    secret: input.env.SUPABASE_JWT_SECRET,
    issuer: `${input.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
    audience: "authenticated",
    // Modern Supabase projects sign access tokens with ES256 — passing the
    // project URL makes the verifier ALSO accept asymmetric tokens via the
    // JWKS endpoint. HS256 path remains live for legacy / Docker-local.
    supabaseUrl: input.env.SUPABASE_URL,
  });
  const hypothesisModule = createHypothesisModule({ prismaService });

  // Story 1-2 wiring (Q4=A + Q5):
  //   - milestonesModule is built FIRST with a Prisma-backed CompassReader
  //     that closes over prismaService (NOT over compassService) — keeps the
  //     two modules instantiation-acyclic.
  //   - compassModule receives milestonesModule.presenceProbe (real probe,
  //     replacing the stub from story 1-1).
  const compassReader: CompassReader = {
    async read(userId) {
      const row = await prismaService.client.hypothesis.findUnique({
        where: { userId },
        select: { objectif: true, horizonYears: true },
      });
      if (!row) return null;
      return {
        objectif: decimalToNumber(row.objectif, 0),
        horizonYears: row.horizonYears,
      };
    },
  };
  const milestonesModule = createMilestonesModule({ prismaService, compassReader });
  const milestonePresenceProbe: MilestonePresenceProbe = milestonesModule.presenceProbe;

  // Story 1-3 T9 — Prisma-backed adapter over the brownfield monthly_tracking
  // table. Closure pattern (mirrors compassReader above) keeps the compass
  // module decoupled from MonthlyTracking — Epic 5 will swap this for a
  // proper monthly module wiring without touching compass.
  // L24 invariant: capitalTotal is Prisma.Decimal — coerce via decimalToNumber,
  // never `Number(decimal)`. The 28-of-month UTC proxy is a safe last-of-month
  // anchor (valid in every month, no leap-year edge case).
  const wealthHistoryProvider: WealthHistoryProvider = {
    async read(userId) {
      const rows = await prismaService.client.monthlyTracking.findMany({
        where: { userId },
        orderBy: [{ year: "asc" }, { monthNum: "asc" }],
        select: { year: true, monthNum: true, capitalTotal: true },
      });
      return rows.map((row) => ({
        at: new Date(Date.UTC(row.year, row.monthNum - 1, 28)),
        totalEur: decimalToNumber(row.capitalTotal, 0),
      }));
    },
  };
  const compassModule = createCompassModule({
    prismaService,
    milestonePresenceProbe,
    wealthHistoryProvider,
  });

  // Story 2-1 — accounts oRPC port. The module is independent of compass /
  // milestones (no cross-aggregate reader needed) so wiring stays trivial.
  // The FK guard against `holdings` lives inside the service via a
  // $transaction-scoped repository (TOCTOU avoidance).
  const accountsModule = createAccountsModule({ prismaService });

  // Story 3-1 — holdings oRPC port. Independent of compass / accounts (the
  // cross-aggregate account FK probe lives inside the repository — no
  // separate accounts dep needed at the module-factory layer).
  const holdingsModule = createHoldingsModule({ prismaService, env: input.env });

  // Story 4-1 — realestate domain. Greenfield aggregate (4 tables); no
  // brownfield port. The cross-aggregate guard lives inside the service via
  // findByIdForUser; module factory stays trivial.
  const realestateModule = createRealestateModule({ prismaService });

  // Story 5-1 — transactions domain. The cross-aggregate accountId guard is
  // injected as a narrow AccountOwnershipProbe adapter wrapping
  // accountsModule.service.accountExists — keeps L1 conformance (no
  // AccountsRepository type leak across modules) and avoids a wiring cycle.
  // Story 5-2 extends the wiring with an AccountResolver adapter for CSV
  // label→id resolution (findAccountIdByLabel).
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: {
      exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
    },
    accountResolver: {
      resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label),
    },
  });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
    realestate: realestateModule.router,
    transactions: transactionsModule.router,
  };

  return {
    env: input.env,
    readiness,
    prismaService,
    jwtVerifier,
    orpcRouter,
    milestonePresenceProbe,
  };
}
