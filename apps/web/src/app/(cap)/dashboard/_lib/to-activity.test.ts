// apps/web/src/app/(cap)/dashboard/_lib/to-activity.test.ts
// Story 7-2 (D4) — the shared Transaction → Activity mapping. Asserts the
// inflow/outflow → in/out direction map, the category → French label lookup,
// the caller-supplied account label, and logoUrl passthrough.
import { describe, expect, it } from "vitest";
import { TRANSACTION_CATEGORY_LABELS, type Transaction } from "@pekulo/validators";
import { txToActivity } from "./to-activity";

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_aaaaaaaaaaaaaaaaaaaaa",
    accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
    occurredOn: "2026-06-01",
    label: "Carrefour",
    amount: 42,
    type: "outflow",
    category: "courses",
    isImprevu: false,
    notes: null,
    transferPairId: null,
    logoUrl: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    ...over,
  } as Transaction;
}

describe("txToActivity", () => {
  it("maps an inflow to direction 'in'", () => {
    expect(txToActivity(tx({ type: "inflow" }), "Compte").direction).toBe("in");
  });

  it("maps an outflow to direction 'out'", () => {
    expect(txToActivity(tx({ type: "outflow" }), "Compte").direction).toBe("out");
  });

  it("maps the raw category to its French label", () => {
    expect(txToActivity(tx({ category: "courses" }), "Compte").category).toBe(
      TRANSACTION_CATEGORY_LABELS.courses,
    );
  });

  it("uses the caller-supplied account label", () => {
    expect(txToActivity(tx(), "Livret A").account).toBe("Livret A");
  });

  it("passes logoUrl through, defaulting a missing one to null", () => {
    expect(txToActivity(tx({ logoUrl: "/v1/logos?ref=abc" }), "X").logoUrl).toBe(
      "/v1/logos?ref=abc",
    );
    expect(txToActivity(tx({ logoUrl: undefined }), "X").logoUrl).toBeNull();
    expect(txToActivity(tx({ amount: 99.9 }), "X").amountEur).toBe(99.9);
  });
});
