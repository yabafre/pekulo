import type { AnyElysia } from "elysia";
import type { PrismaService } from "../database";

export interface LifecycleOptions {
  shutdownTimeoutMs: number;
}

export interface LifecycleDeps {
  prismaService: PrismaService;
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
      const outcome = await Promise.race([app.stop().then(() => "stopped" as const), timeout]);
      if (outcome === "timeout") {
        console.error(`[api] shutdown timed out after ${options.shutdownTimeoutMs}ms`);
        exitCode = 1;
      }
      // Drain Prisma connection pool AFTER Elysia stops accepting new requests.
      await deps.prismaService.disconnect();
    } catch (err) {
      console.error("[api] error during shutdown:", err);
      exitCode = 1;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      process.exit(exitCode);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
