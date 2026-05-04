import { Elysia } from "elysia";
import type { ProbeResult } from "../../bootstrap/readiness";
import type { HealthModuleDeps } from "./health.module";

function publicProbeView(probes: Record<string, ProbeResult>): Record<string, { ok: boolean }> {
  return Object.fromEntries(Object.entries(probes).map(([name, r]) => [name, { ok: r.ok }]));
}

export function healthRoutes(deps: HealthModuleDeps) {
  return new Elysia({ name: "health" })
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", async ({ set }) => {
      const report = await deps.readiness.check();
      const probes = publicProbeView(report.probes);
      if (!report.ready) {
        set.status = 503;
        return { ready: false, probes };
      }
      return { ready: true, probes };
    });
}
