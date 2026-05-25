// apps/api/src/common/derive/transfer-rule.ts
// Pure account-pair-match decision for the transfer-rule (story 5-3, FR-30).
//
// Inputs by argument only. No persistence layer, no wall-clock reads, no
// outbound calls, no observability imports (AC-10 grep guard — see story
// file for the literal token list this module must not contain).
//
// The repository upstream is responsible for filtering siblings to those that
// are PAIR-ELIGIBLE :
//   - same user (RLS + explicit where: { userId })
//   - opposite type
//   - same occurredOn (date)
//   - same amount
//   - different accountId
//   - category = "autre"
//   - transferPairId = null
// AND for ordering FIFO by (createdAt asc, id asc) so that this derive picks
// the OLDEST unpaired sibling on ambiguity.
//
// This derive applies the structural pair-match (defensive duplicate of the
// SQL WHERE clause — guards against a future caller passing pre-filtered but
// inexact siblings) and returns the first match or null.

export interface SiblingCandidate {
  id: string;
  accountId: string;
  occurredOn: string;
  amount: number;
  type: "inflow" | "outflow";
}

export interface DetectTransferPairInput {
  candidate: SiblingCandidate;
  siblings: SiblingCandidate[];
}

export interface DetectTransferPairOutput {
  pair: SiblingCandidate | null;
}

function oppositeType(t: "inflow" | "outflow"): "inflow" | "outflow" {
  return t === "inflow" ? "outflow" : "inflow";
}

export function detectTransferPair(input: DetectTransferPairInput): DetectTransferPairOutput {
  const { candidate, siblings } = input;
  const wanted = oppositeType(candidate.type);
  for (const s of siblings) {
    if (s.id === candidate.id) continue;
    if (s.type !== wanted) continue;
    if (s.occurredOn !== candidate.occurredOn) continue;
    if (s.amount !== candidate.amount) continue;
    if (s.accountId === candidate.accountId) continue;
    return { pair: s };
  }
  return { pair: null };
}
