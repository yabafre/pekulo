import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
}

// F10: a single transient probe failure should not yank traffic on Dokploy /
// K8s. We track consecutive failures in closure and only flip the probe to
// `ok: false` after two in a row. The probe still runs the live SELECT 1 every
// invocation; the debounce only changes the verdict reporting.
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
        // First failure — likely transient. Report degraded with a marker so
        // /ready still says ready=true overall (operator-visible reason); next
        // failure flips us to ok:false and yanks traffic.
        return { ok: true, reason: `prisma transient (${reason})` };
      }
      return { ok: false, reason: `prisma down (${consecutivePrismaFailures} consecutive): ${reason}` };
    }
  });

  return { env: input.env, readiness, prismaService };
}
