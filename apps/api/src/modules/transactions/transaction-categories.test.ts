// bun:test — category taxonomy guard (story 6-8, DR-13). Proves the four new
// categories are wired into the closed enum, labelled, and LLM-suggestable,
// and that the suggestable subset stays = enum minus the two system values.
import { describe, it, expect } from "bun:test";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  SUGGESTABLE_TRANSACTION_CATEGORIES,
} from "@pekulo/validators";

const NEW_CATEGORIES = ["factures", "restauration", "abonnements", "retrait"] as const;

// AC-1 (verbatim from story 6-8-category-taxonomy-expansion:19):
//   Given the expanded taxonomy, When the LLM categorises a non-transfer
//   transaction, Then factures / restauration / abonnements / retrait are valid
//   suggestion targets — they appear in the categorisation prompt's allowed-
//   category list.
// AC-4 (verbatim from story 6-8-category-taxonomy-expansion:22):
//   Then the taxonomy's compile-time guards hold for all 17 values — every
//   category has a French label and every suggestable value is a member of the
//   closed enum.
describe("category taxonomy (story 6-8, DR-13)", () => {
  it("registers the four new categories in the closed enum", () => {
    for (const c of NEW_CATEGORIES) {
      expect(TRANSACTION_CATEGORIES).toContain(c);
    }
  });

  it("gives every category a non-empty French label", () => {
    for (const c of TRANSACTION_CATEGORIES) {
      expect(typeof TRANSACTION_CATEGORY_LABELS[c]).toBe("string");
      expect(TRANSACTION_CATEGORY_LABELS[c].length).toBeGreaterThan(0);
    }
  });

  it("makes the four new categories LLM-suggestable", () => {
    for (const c of NEW_CATEGORIES) {
      expect(SUGGESTABLE_TRANSACTION_CATEGORIES).toContain(c);
    }
  });

  it("keeps the two system values out of the suggestable subset", () => {
    expect(SUGGESTABLE_TRANSACTION_CATEGORIES).not.toContain("transfer");
    expect(SUGGESTABLE_TRANSACTION_CATEGORIES).not.toContain("autre");
  });

  it("suggestable subset equals the enum minus transfer + autre (no drift)", () => {
    const expected = TRANSACTION_CATEGORIES.filter((c) => c !== "transfer" && c !== "autre");
    expect([...SUGGESTABLE_TRANSACTION_CATEGORIES]).toEqual([...expected]);
  });
});
