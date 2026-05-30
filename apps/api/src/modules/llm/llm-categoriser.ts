// apps/api/src/modules/llm/llm-categoriser.ts
// Parse a provider's raw completion into {category, confidence} (story 6-2,
// FR-32). Pure: no I/O, no clock, no env. Tolerant — the model may wrap JSON in
// prose / code fences, so we slice the first balanced-looking {...} block before
// parsing. ABSTAINS to {category: null, confidence: 0} on ANY failure
// (unparseable, category outside the closed list, confidence not finite) so a
// bad completion never crashes the create path nor injects an out-of-enum
// category (AC-2). `categories` is the closed allowlist the caller permits.

export interface ParsedCategorisation {
  category: string | null;
  confidence: number;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function parseCategorisation(
  raw: string,
  categories: readonly string[],
): ParsedCategorisation {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { category: null, confidence: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { category: null, confidence: 0 };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { category: null, confidence: 0 };
  }
  const obj = parsed as { category?: unknown; confidence?: unknown };
  const category = typeof obj.category === "string" ? obj.category : null;
  if (category === null || !categories.includes(category)) {
    return { category: null, confidence: 0 };
  }
  return { category, confidence: clampConfidence(obj.confidence) };
}
