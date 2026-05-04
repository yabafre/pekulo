import type { Readiness } from "../../bootstrap/readiness";
import { healthRoutes } from "./health.routes";

export interface HealthModuleDeps {
  readiness: Readiness;
}

// ADR-0009 module factory contract: returns `{ router, service? }`.
// The health module is degenerate (no service layer — pure stateless probes),
// so `service` is omitted; `router` mirrors every domain factory in epics 1-8.
export function createHealthModule(deps: HealthModuleDeps) {
  return {
    router: healthRoutes(deps),
  };
}
