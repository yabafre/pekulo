import type { AnyElysia } from "elysia";
import type { PrismaService } from "../database";

export interface LifecycleOptions {
  shutdownTimeoutMs: number;
}

export interface LifecycleDeps {
  prismaService: PrismaService;
  shutdownOtel: () => Promise<void>;
}

/**
 * Bound an async step against a budget. Errors in `promise` are caught and
 * logged as `[api] {label} failed:`. Returns true on success, false on
 * timeout or rejection. Resources held by the underlying promise are NOT
 * cancelled on timeout — Bun/Node have no generic cancellation primitive
 * for arbitrary Promises; the caller proceeds to the next step on `false`.
 */
async function withTimeout(label: string, promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutSignal: unique symbol = Symbol("timeout") as never;
  const timeout = new Promise<typeof timeoutSignal>((resolve) => {
    timer = setTimeout(() => resolve(timeoutSignal), ms);
  });
  const wrapped = promise.then(
    () => "done" as const,
    (err) => {
      console.error(`[api] ${label} failed:`, err);
      return "error" as const;
    },
  );
  try {
    const outcome = await Promise.race([wrapped, timeout]);
    if (outcome === timeoutSignal) {
      console.error(`[api] ${label} timed out after ${ms}ms`);
      return false;
    }
    return outcome === "done";
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function registerLifecycle(
  app: AnyElysia,
  options: LifecycleOptions,
  deps: LifecycleDeps,
): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    let exitCode = 0;
    // Per-step budget split (story 0-7 review finding H8):
    //   - elysia 30 % — request drain
    //   - otel   50 % — span flush (BSP exportTimeoutMillis: 2000 fits inside)
    //   - prisma 20 % — pool drain
    // Every step gets a bounded slice so a stuck step cannot blow the
    // entire SHUTDOWN_TIMEOUT_MS budget. Defaults at 10 000 ms total →
    // (3000, 5000, 2000) ms.
    const total = options.shutdownTimeoutMs;
    const elysiaBudget = Math.max(1, Math.floor(total * 0.3));
    const otelBudget = Math.max(1, Math.floor(total * 0.5));
    const prismaBudget = Math.max(1, total - elysiaBudget - otelBudget);

    if (!(await withTimeout("elysia.stop", app.stop(), elysiaBudget))) {
      exitCode = 1;
    }

    // Flush OTel BEFORE Prisma disconnects — span ordering rationale lives
    // in the story 0-7 file under § Lifecycle ordering.
    if (!(await withTimeout("otel.shutdown", deps.shutdownOtel(), otelBudget))) {
      exitCode = 1;
    }

    // Drain Prisma connection pool ALWAYS — even if previous steps failed.
    // Otherwise Postgres keeps half-closed connections until the TCP
    // teardown is observed, wasting pool slots on Dokploy.
    if (!(await withTimeout("prisma.disconnect", deps.prismaService.disconnect(), prismaBudget))) {
      exitCode = 1;
    }

    process.exit(exitCode);
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
