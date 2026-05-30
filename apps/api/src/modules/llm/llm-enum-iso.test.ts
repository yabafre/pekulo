// bun:test — drift guard for the LLM enum mirrors (story 6-1 review).
// @pekulo/validators CANNOT import @pekulo/types at runtime (one-way layering,
// R1 — the runtime import creates a TDZ cycle), so llm.schemas.ts mirrors
// LLM_ROUTES / LLM_OUTCOMES inline. That mirror was previously unguarded: a
// silent drift would not fail any gate. This test fails the build the moment
// the validators enums diverge from the @pekulo/types source of truth.
import { test, expect } from "bun:test";
import { LLM_ROUTES, LLM_OUTCOMES } from "@pekulo/types";
import { llmRouteSchema, llmOutcomeSchema } from "@pekulo/validators";

test("llmRouteSchema is iso with @pekulo/types#LLM_ROUTES", () => {
  expect([...llmRouteSchema.options]).toEqual([...LLM_ROUTES]);
});

test("llmOutcomeSchema is iso with @pekulo/types#LLM_OUTCOMES", () => {
  expect([...llmOutcomeSchema.options]).toEqual([...LLM_OUTCOMES]);
});
