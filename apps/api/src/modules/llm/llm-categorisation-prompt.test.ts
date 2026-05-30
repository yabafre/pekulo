// bun:test — buildCategorisationPrompt (story 6-2, AC-5 / NFR-12).
import { test, expect } from "bun:test";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { buildCategorisationPrompt } from "./llm-prompt-builder";

const envelope: LlmPromptEnvelope = {
  label: "Carrefour",
  amount: -42.5,
  currency: "EUR",
  occurredOn: "2026-05-15",
};

test("embeds the closed category list and the envelope", () => {
  const prompt = buildCategorisationPrompt(envelope, ["courses", "transport"]);
  expect(prompt).toContain("courses, transport");
  expect(prompt).toContain('"label":"Carrefour"');
  expect(prompt).toContain("STRICT JSON");
});

test("carries no key outside the envelope allowlist (NFR-12)", () => {
  const prompt = buildCategorisationPrompt(envelope, ["courses"]);
  expect(prompt).not.toContain("userId");
  expect(prompt).not.toContain("accountNumber");
});
