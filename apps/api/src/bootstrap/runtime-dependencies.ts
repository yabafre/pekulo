import type {
  CompassReader,
  LlmRoute,
  MilestonePresenceProbe,
  WealthHistoryProvider,
} from "@pekulo/types";
import type { Env } from "../config/env";
import { createPrismaService, generateBase62Id, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createAccountsModule } from "../modules/accounts/accounts.module";
import { createBankAggregatorModule } from "../modules/bank-aggregator/bank-aggregator.module";
import { createBridgeProvider } from "../modules/bank-aggregator/services/bridge-client";
import { createLogosModule } from "../modules/logos/logos.module";
import { createLlmModule } from "../modules/llm/llm.module";
import { createCompassModule } from "../modules/compass/compass.module";
import { createHoldingsModule } from "../modules/holdings/holdings.module";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createMilestonesModule } from "../modules/milestones/milestones.module";
import { createMonthlyModule } from "../modules/monthly/monthly.module";
import { createRealestateModule } from "../modules/realestate/realestate.module";
import { createDashboardModule } from "../modules/dashboard/dashboard.module";
import { createSettingsModule } from "../modules/settings/settings.module";
import { createTransactionsModule } from "../modules/transactions/transactions.module";
import {
  createSuggestionBackfillScheduler,
  type SuggestionBackfillScheduler,
} from "../modules/transactions/services/suggestion-backfill-scheduler";
import type {
  LlmOverrideAuditPort,
  TransactionCategoriser,
} from "../modules/transactions/transactions.service";
import { hashLabel } from "../modules/llm/llm-prompt-builder";
import { decimalToNumber } from "../common/derive/decimal-to-number";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
  orpcRouter: PekuloRpcRouter;
  milestonePresenceProbe: MilestonePresenceProbe;
  bankAggregatorModule: ReturnType<typeof createBankAggregatorModule>;
  llmModule: ReturnType<typeof createLlmModule>;
  transactionsModule: ReturnType<typeof createTransactionsModule>;
  logosModule: ReturnType<typeof createLogosModule>;
  suggestionBackfillTask: SuggestionBackfillScheduler;
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

  // Story 6-1 — LLM routing + audit module. No oRPC router (the only HTTP
  // surface is the /internal/llm/attest listener mounted in app.ts). Built
  // BEFORE transactionsModule (story 6-2) so the categorise pipeline can be
  // wired as a narrow port into transactions.
  const llmModule = createLlmModule({
    prismaService,
    env: input.env,
    jwtVerifier,
  });

  // Story 6-2 (FR-32) — narrow categoriser adapter wrapping llmModule.service.
  // The web tier never reports FoundationModels capability (iOS-only, V1.5), so
  // clientCapabilities is pinned to { iosFoundationModels: false } → Ollama. V1
  // transactions are EUR, so currency is pinned to "EUR".
  const transactionCategoriser: TransactionCategoriser = {
    categorise: async ({ userId, label, amountSigned, occurredOn, categories }) => {
      const result = await llmModule.service.categorise({
        userId,
        clientCapabilities: { iosFoundationModels: false },
        prompt: { label, amount: amountSigned, currency: "EUR", occurredOn },
        categories,
      });
      return {
        category: result.category,
        confidence: result.confidence,
        route: result.route,
        failed: result.failed,
      };
    },
  };

  // Story 6-4 (FR-33 / AC-2) — narrow override-audit adapter over the LLM
  // module's SOLE llm_call_log writer (recordLlmCall; ADR-0008 / architecture
  // L691). Keeps transactions free of LlmService/LlmRoute (L1, mirrors the
  // categoriser port). `route` is the route_actual stored on the suggestion;
  // hashLabel gives the NFR-26 de-dup digest (NEVER the prompt body). The
  // recordLlmCall route guard backs the `as LlmRoute` cast.
  const llmOverrideAudit: LlmOverrideAuditPort = {
    recordOverride: ({ userId, route, label }) =>
      llmModule.service.recordLlmCall(userId, {
        phase: "outcome",
        callId: generateBase62Id(21),
        route: route as LlmRoute,
        labelHash: hashLabel(label),
        latencyMs: 0,
        outcome: "overridden",
      }),
  };

  // Story 6-10 (FR-65) — ONE Bridge provider shared by bank-aggregator + logos
  // (breaks the logos↔provider↔bank-aggregator cycle), then the logos module.
  // Built BEFORE transactionsModule so the read-path logo enrich (T15) and the
  // bank-refresh warm-up (T14) can be wired as narrow ports without a cycle.
  const bankProvider = createBridgeProvider({ env: input.env });
  const logosModule = createLogosModule({
    prismaService,
    env: input.env,
    getBankLogo: async (providerId) => (await bankProvider.getProviderLogo(providerId)).logoUrl,
  });

  // Story 5-1 — transactions domain. The cross-aggregate accountId guard is
  // injected as a narrow AccountOwnershipProbe adapter wrapping
  // accountsModule.service.accountExists — keeps L1 conformance (no
  // AccountsRepository type leak across modules) and avoids a wiring cycle.
  // Story 5-2 extends with an AccountResolver adapter; story 6-2 with the
  // TransactionCategoriser adapter above.
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: {
      exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
      existsMany: (userId, accountIds) => accountsModule.service.accountsExist(userId, accountIds),
    },
    accountResolver: {
      resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label),
    },
    categoriser: transactionCategoriser,
    llmAudit: llmOverrideAudit,
    logos: logosModule.service, // story 6-10 — enrich list reads with logoUrl
    // story 7-2 D3 — resolve account labels for the dashboard recentActivity DTO
    accountLister: { list: (userId) => accountsModule.service.list(userId) },
  });

  const monthlyModule = createMonthlyModule({ prismaService });

  const bankAggregatorModule = createBankAggregatorModule({
    prismaService,
    env: input.env,
    provider: bankProvider, // share the provider (story 6-10)
    logos: logosModule.service, // story 6-10 — warm logo caches on bank refresh
    transactionsService: transactionsModule.service,
    accountsService: accountsModule.service,
  });

  // Backfill (épic 6) — hourly LLM-categorisation sweep over still-'autre',
  // never-attempted rows (the safety net behind the post-sync backfill).
  // Started in app.ts, stopped in lifecycle.ts (same shape as the bank cron).
  const suggestionBackfillTask = createSuggestionBackfillScheduler({
    env: input.env,
    service: transactionsModule.service,
  });

  // Story 7-1 (FR-43, FR-44) — dashboard cross-domain aggregator. Pure
  // composition module: no repository, no Prisma. Narrow read ports over the
  // four wealth-bearing modules + compass. Holdings priced live via the
  // holdings 4-tier chain (resolveQuote, 60s cache); FX via the frankfurter
  // client the holdings module exposes for exactly this (holdings.module L39).
  const dashboardModule = createDashboardModule({
    prismaService,
    listAccounts: (userId) => accountsModule.service.list(userId),
    listHoldings: (userId) => holdingsModule.service.list(userId, { includeClosed: false }),
    resolveQuote: (input) => holdingsModule.service.resolveQuote(input),
    getRates: (base) => holdingsModule.frankfurterClient.getRates(base),
    getTotalEquity: (userId) => realestateModule.service.getTotalEquity(userId),
    getCompass: (userId) => compassModule.service.getCompass(userId),
    computeProgress: (input) => compassModule.service.computeProgress(input),
    // story 7-2 D3 — recent activity port (transactions + account labels)
    listRecentActivity: (userId, limit) =>
      transactionsModule.service.listRecentActivity(userId, limit),
    // story 7-4 (FR-59) — projection read port for the gap composition. Same
    // service the /rpc/v1/hypothesis getProjection procedure uses; passing it
    // as a port keeps the dashboard decoupled from the hypothesis module.
    getHypothesisProjection: (userId, currentWealthEur) =>
      hypothesisModule.service.getProjection(userId, currentWealthEur),
  });

  // Story 8-2 (FR-51/FR-52) — per-user theme/lang preferences. A pure per-user
  // singleton store; only needs prismaService (mirrors dashboard's layout half).
  const settingsModule = createSettingsModule({ prismaService });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
    realestate: realestateModule.router,
    dashboard: dashboardModule.router,
    transactions: transactionsModule.router,
    monthly: monthlyModule.router,
    bankaggregator: bankAggregatorModule.router,
    llm: llmModule.router,
    settings: settingsModule.router,
  };

  return {
    env: input.env,
    readiness,
    prismaService,
    jwtVerifier,
    orpcRouter,
    milestonePresenceProbe,
    bankAggregatorModule,
    llmModule,
    transactionsModule,
    logosModule,
    suggestionBackfillTask,
  };
}
