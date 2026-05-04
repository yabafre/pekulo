import type { AnyElysia } from "elysia";
import type { PrismaService } from "../database";

export interface LifecycleOptions {
  shutdownTimeoutMs: number;
}

export interface LifecycleDeps {
  prismaService: PrismaService;
  shutdownOtel: () => Promise<void>;
}

export async function registerLifecycle(
  app: AnyElysia,
  options: LifecycleOptions,
  deps: LifecycleDeps,
): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    let exitCode = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), options.shutdownTimeoutMs);
      });
      try {
        const outcome = await Promise.race([app.stop().then(() => "stopped" as const), timeout]);
        if (outcome === "timeout") {
          console.error(`[api] elysia.stop timed out after ${options.shutdownTimeoutMs}ms`);
          exitCode = 1;
        }
      } catch (err) {
        console.error("[api] elysia.stop failed:", err);
        exitCode = 1;
      }
      // Flush OTel BEFORE Prisma disconnects — span ordering rationale lives
      // in the story 0-7 file under § Lifecycle ordering.
      try {
        await deps.shutdownOtel();
      } catch (err) {
        console.error("[api] otel.shutdown failed:", err);
        exitCode = 1;
      }
      // Drain Prisma connection pool ALWAYS — even if elysia.stop threw or timed
      // out. Otherwise the Postgres backend keeps the half-closed connections
      // until it notices the TCP teardown, wasting pool slots on Dokploy.
      try {
        await deps.prismaService.disconnect();
      } catch (err) {
        console.error("[api] prisma.disconnect failed:", err);
        exitCode = 1;
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      process.exit(exitCode);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
