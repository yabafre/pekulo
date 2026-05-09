import type { CompassReader, MilestonePresenceProbe } from "@pekulo/types";
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createCompassModule } from "../modules/compass/compass.module";
import { createMilestonesModule } from "../modules/milestones/milestones.module";
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
  const compassModule = createCompassModule({
    prismaService,
    milestonePresenceProbe,
  });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
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
