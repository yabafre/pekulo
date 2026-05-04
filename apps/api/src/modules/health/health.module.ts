import type { Readiness } from "../../bootstrap/readiness";
import { healthRoutes } from "./health.routes";

export interface HealthModuleDeps {
  readiness: Readiness;
}

export function createHealthModule(deps: HealthModuleDeps) {
  return {
    routes: healthRoutes(deps),
  };
}
