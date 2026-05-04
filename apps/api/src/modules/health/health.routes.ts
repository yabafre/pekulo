import { Elysia } from "elysia";
import type { HealthModuleDeps } from "./health.module";

export function healthRoutes(deps: HealthModuleDeps) {
  return new Elysia({ name: "health" })
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", async ({ set }) => {
      const report = await deps.readiness.check();
      if (!report.ready) {
        set.status = 503;
        return { ready: false, probes: report.probes };
      }
      return { ready: true, probes: report.probes };
    });
}
