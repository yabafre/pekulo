import { describe, expect, test } from "bun:test";
import { isResolvableMerchantKey, normalizeMerchantKey } from "./merchant-key";

// AC-1 (verbatim from story 6-10-merchant-logos:38):
//   Given a Bridge-sourced transaction whose merchant is recognised, When the
//   row renders, Then the merchant logo is shown (tier 1).
// AC-5 (verbatim from story 6-10-merchant-logos:42):
//   … A merchant that fails to resolve is remembered as "no logo" and not
//   looked up again before its refresh window elapses.
describe("normalizeMerchantKey (story 6-10 / FR-65)", () => {
  test("strips card-payment prose + dates, keeps the merchant tokens", () => {
    expect(normalizeMerchantKey("CB Mad Cours Marjane M.m G")).toBe("mad cours marjane");
    expect(normalizeMerchantKey("PAIEMENT PAR CARTE 09/11/2024 CARREFOUR CITY")).toBe(
      "carrefour city",
    );
  });

  test("is deterministic + accent/case-insensitive", () => {
    expect(normalizeMerchantKey("Sàrl Pâtisserie")).toBe(normalizeMerchantKey("SARL PATISSERIE"));
  });

  test("all-noise labels normalise to an unresolvable key", () => {
    const k = normalizeMerchantKey("CB PAIEMENT PAR CARTE 09/11");
    expect(isResolvableMerchantKey(k)).toBe(false);
  });

  // Statement-line vocabulary must NOT resolve a merchant logo (the brand it
  // would prefix-match is spurious — 6-10 review).
  test("statement-line labels normalise to an unresolvable key", () => {
    for (const label of ["Relevé Différé", "Cb Temporary Transaction", "Commission Paiement Par"]) {
      expect(isResolvableMerchantKey(normalizeMerchantKey(label))).toBe(false);
    }
  });

  // Transfer + civility title = a person, not a merchant (6-10 review).
  test("person-to-person transfers don't resolve a merchant; org transfers still do", () => {
    expect(isResolvableMerchantKey(normalizeMerchantKey("Vir Sepa M John Doe"))).toBe(false);
    expect(isResolvableMerchantKey(normalizeMerchantKey("Vir Inst Mme Jane Doe"))).toBe(false);
    expect(normalizeMerchantKey("Vir Sepa Matmut Rouen")).toBe("matmut rouen"); // no civility → kept
  });
});
