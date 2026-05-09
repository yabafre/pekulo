import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createCompassModule } from "../modules/compass/compass.module";
import type { MilestonePresenceProbe } from "../modules/compass/compass.types";

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
  // Story 1-2 swaps this stub for a Prisma-backed probe wired through the
  // milestones repository. Until then the compass setup is reported
  // 'incomplete' whenever a milestone presence is required (FR-8).
  const milestonePresenceProbe: MilestonePresenceProbe = {
    async hasAny() {
      return false;
    },
  };
  const compassModule = createCompassModule({ prismaService, milestonePresenceProbe });
  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
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
