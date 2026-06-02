import { describe, expect, test } from "bun:test";
import { curatedMerchantQuery } from "./merchant-domains";

// Story 6-10 (FR-65) — the curated map is the high-recall path: it must catch a
// known brand even when buried mid-label past the 3-token cache key.
describe("curatedMerchantQuery (story 6-10 / FR-65)", () => {
  test("finds a merchant buried past the 3-token key", () => {
    // key would be "mad cours mcdonald" → Brandfetch [] ; the alias rescues it
    expect(curatedMerchantQuery("CB Mad Cours Mcdonald S Agdal Oncf")).toBe("mcdonalds");
    expect(curatedMerchantQuery("CB Mad Cours Total l Ouagar")).toBe("totalenergies");
  });

  test("bigram alias beats the unigram (uber eats ≠ uber)", () => {
    expect(curatedMerchantQuery("CB Uber Eats Paris 12")).toBe("uber eats");
    expect(curatedMerchantQuery("CB Uber Trip 0034")).toBe("uber");
  });

  test("accent- and case-insensitive", () => {
    expect(curatedMerchantQuery("PRLV SÉPHORA")).toBe("sephora");
    expect(curatedMerchantQuery("cb monoprix")).toBe("monoprix");
  });

  test("unknown / long-tail label → null (falls back to raw search)", () => {
    expect(curatedMerchantQuery("CB Le Bistrot Du Coin")).toBeNull();
    expect(curatedMerchantQuery("Vir Sepa M Doe John")).toBeNull();
  });
});
