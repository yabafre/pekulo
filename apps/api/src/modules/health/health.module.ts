import type { Elysia } from "elysia";
import type { Readiness } from "../../bootstrap/readiness";
import { healthRoutes } from "./health.routes";

export interface HealthModuleDeps {
  readiness: Readiness;
}

export interface HealthModule {
  routes: Elysia;
}

export function createHealthModule(deps: HealthModuleDeps): HealthModule {
  return {
    routes: healthRoutes(deps),
  };
}
