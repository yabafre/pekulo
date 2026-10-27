// apps/api/src/modules/advisory/advisory-prompt-builder.ts
// Dedicated advisory prompt builder with grounding invariants and ADR-0016 §2 scoped carve-out (story 12-3, AC-1).

import type { AdvisorySnapshot } from "@pekulo/validators";

// AC-1 (verbatim from story 12-3:17):
//   Given a deterministic financial snapshot produced by the analysis engine,
//   When the advisory LLM task runs, Then the LLM returns structured analysis
//   and actionable recommendations (including instrument-level buy/sell/hold
//   guidance per ADR-0016 §2), and surfaces no monetary amount, percentage,
//   or price that is not present in the snapshot.
export function buildAdvisoryPrompt(snapshot: AdvisorySnapshot): string {
  return [
    "You are Pekulo's private internal financial advisory AI engine for Persona #1.",
    "You are provided with a complete, verified deterministic financial snapshot.",
    "",
    "STRICT GROUNDING INVARIANTS (BINDING):",
    "1. You are strictly FORBIDDEN from inventing, guessing, or hallucinating any monetary amounts, currency figures, percentages, or asset prices not explicitly present in the snapshot below.",
    "2. All 'pct' fields in the snapshot are already expressed in percent (for instance, pct: 0.2 means 0.2%, NOT 20%). Every number you cite MUST come verbatim from the snapshot.",
    "3. DO NOT calculate, deduce, or estimate your own percentages or ratios (e.g., do not divide a holding by a category total). If a percentage is not already explicitly written in the snapshot, do not state a percentage for it; use the euro amount from the snapshot instead.",
    "4. DO NOT invent hypothetical percentages, target figures, or rules of thumb (such as '50%', '10%', '5-10%') in your rationales. When recommending to trim, rebalance, or allocate, describe the action qualitatively (e.g., 'trim moderately', 'increase liquid buffer') without inventing new numbers.",
    "5. ADR-0016 §2 SCOPED CARVE-OUT: You MAY and SHOULD provide actionable buy/sell/hold/rebalance recommendations, including instrument-level recommendations for instruments listed in the portfolio.",
    "",
    "FINANCIAL SNAPSHOT (JSON):",
    JSON.stringify(snapshot, null, 2),
    "",
    "OUTPUT INSTRUCTIONS:",
    "Return ONLY a valid JSON object matching this schema (no markdown formatting, no code fences):",
    "{",
    '  "overview": "Summary diagnosis of financial posture",',
    '  "strengths": ["Strength 1", "Strength 2"],',
    '  "risks": ["Risk or concentration 1", "Risk 2"],',
    '  "allocationAdvice": "Detailed cash vs investments vs real estate allocation commentary",',
    '  "recommendations": [',
    "    {",
    '      "id": "rec-1",',
    '      "title": "Action title",',
    '      "action": "buy" | "sell" | "hold" | "trim" | "rebalance" | "allocate" | "reduce",',
    '      "target": "Target asset or account name",',
    '      "rationale": "Why this action is recommended",',
    '      "priority": "high" | "medium" | "low",',
    '      "instrumentRecommendation": {',
    '        "symbol": "TICKER",',
    '        "isin": "OPTIONAL_ISIN",',
    '        "action": "buy" | "sell" | "hold" | "trim",',
    '        "rationale": "Rationale"',
    "      } | null",
    "    }",
    "  ]",
    "}",
  ].join("\n");
}
