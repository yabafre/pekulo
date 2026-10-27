// apps/api/src/modules/advisory/advisory-posture.test.ts
// Tests for advisory provider EU-posture assertor (story 12-3, AC-4).

import { describe, expect, it } from "bun:test";
import { assertAdvisoryProviderPosture } from "./advisory-posture";
import { PekuloError } from "../../common/errors";

// AC-4 (verbatim from story 12-3:20):
//   Given the configured LLM provider, When the advisory surface initialises,
//   Then its configuration asserts that the provider is hosted in the EU region
//   and adheres to a zero-data-retention / no-training policy (e.g. Mistral EU by default).
describe("assertAdvisoryProviderPosture (story 12-3)", () => {
  it("approves default Mistral EU endpoint", () => {
    const result = assertAdvisoryProviderPosture({});
    expect(result).toEqual({
      route: "third_party",
      providerName: "mistral",
      region: "EU",
      noTrain: true,
    });
  });

  it("approves explicit Mistral EU endpoint", () => {
    const result = assertAdvisoryProviderPosture({
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
    });
    expect(result.region).toBe("EU");
    expect(result.noTrain).toBe(true);
    expect(result.providerName).toBe("mistral");
  });

  it("approves localhost endpoint for offline development", () => {
    const result = assertAdvisoryProviderPosture({
      baseUrl: "http://localhost:11434/v1/chat/completions",
    });
    expect(result.region).toBe("EU");
    expect(result.providerName).toBe("local");
  });

  it("rejects non-EU / non-compliant endpoint with BAD_REQUEST PekuloError", () => {
    expect(() =>
      assertAdvisoryProviderPosture({
        baseUrl: "https://api.openai.com/v1/chat/completions",
      }),
    ).toThrow(PekuloError);
  });
});
