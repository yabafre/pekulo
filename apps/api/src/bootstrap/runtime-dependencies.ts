import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

  readiness.register("prisma", async () => {
    try {
      await prismaService.client.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  return { env: input.env, readiness, prismaService };
}
