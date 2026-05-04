import type { Elysia } from "elysia";
import type { RuntimeDeps } from "./runtime-dependencies";

export async function registerLifecycle(app: Elysia, _deps: RuntimeDeps): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    try {
      await app.stop();
    } catch (err) {
      console.error("[api] error during shutdown:", err);
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
