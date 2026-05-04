import type { Env } from "../config/env";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  return { env: input.env, readiness };
}
