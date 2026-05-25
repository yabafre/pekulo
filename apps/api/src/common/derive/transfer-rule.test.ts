// apps/api/src/common/derive/transfer-rule.test.ts
// bun:test — TDD for the pure account-pair-match derive (story 5-3 — FR-30).
//
// 7 cases:
//   - match (same date/amount, opposite type, different account, both autre+unpaired) → pair
//   - no-sibling                                                                       → null
//   - wrong-amount (120.00 vs 120.01)                                                  → null
//   - same-account                                                                     → null
//   - wrong-date                                                                       → null
//   - same-type (both outflow)                                                         → null
//   - ambiguous → returns the OLDEST unpaired sibling (FIFO via input ordering)        → pair

import { describe, expect, test } from "bun:test";
import { detectTransferPair, type SiblingCandidate } from "./transfer-rule";

const candidateOut: SiblingCandidate = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-20",
  amount: 120.0,
  type: "outflow",
};

const siblingIn = (over: Partial<SiblingCandidate> = {}): SiblingCandidate => ({
  id: "tx_bbbbbbbbbbbbbbbbbbbbb",
  accountId: "acc_bbb222222222222222222",
  occurredOn: "2026-05-20",
  amount: 120.0,
  type: "inflow",
  ...over,
});

describe("detectTransferPair (derive)", () => {
  // AC-1 (verbatim from story 5-3-transfer-rule:17, excerpt):
  //   the service detects the pair, generates a fresh tp_<21-char-base62> id,
  //   and the repository updates BOTH rows so category=transfer, transferPairId=<same>.
  test("match — same date/amount, opposite type, different account → returns the sibling", () => {
    const out = detectTransferPair({ candidate: candidateOut, siblings: [siblingIn()] });
    expect(out.pair).not.toBeNull();
    expect(out.pair?.id).toBe("tx_bbbbbbbbbbbbbbbbbbbbb");
  });

  // AC-2 (verbatim from story 5-3-transfer-rule:19, excerpt):
  //   no pair → no override, no pair-id stamp.
  test("no-sibling — empty siblings array → null", () => {
    const out = detectTransferPair({ candidate: candidateOut, siblings: [] });
    expect(out.pair).toBeNull();
  });

  test("wrong-amount — 120.00 vs 120.01 → null", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ amount: 120.01 })],
    });
    expect(out.pair).toBeNull();
  });

  // AC-6 (verbatim from story 5-3-transfer-rule:27, excerpt):
  //   same date/amount/user but on the SAME accountId → does NOT pair them.
  test("same-account — sibling on same accountId → null (a transfer must cross accounts)", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ accountId: "acc_aaa111111111111111111" })],
    });
    expect(out.pair).toBeNull();
  });

  test("wrong-date — siblings on different occurredOn → null", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ occurredOn: "2026-05-21" })],
    });
    expect(out.pair).toBeNull();
  });

  test("same-type — both outflow → null (a transfer requires opposite types)", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ type: "outflow" })],
    });
    expect(out.pair).toBeNull();
  });

  // AC-5 (verbatim from story 5-3-transfer-rule:25, excerpt):
  //   ONLY the OLDEST unpaired sibling is paired with the new inflow.
  //   The repository orders by (createdAt asc, id asc) ; this derive picks [0].
  test("ambiguous → returns the FIRST sibling in the input order (FIFO contract — caller orders)", () => {
    const oldest = siblingIn({ id: "tx_ccccccccccccccccccccc" });
    const younger = siblingIn({ id: "tx_dddddddddddddddddddddd" });
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [oldest, younger],
    });
    expect(out.pair?.id).toBe("tx_ccccccccccccccccccccc");
  });
});
