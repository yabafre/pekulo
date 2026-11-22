// apps/mobile/__tests__/helpers/parity-allowlist.ts
// Story 10-5 AC-3 — accepted web ↔ native text-style divergences.
// Key format (exactly what divergenceKey() prints in a failure):
//   `<caseId>|<theme>|<text>#<occurrence>|<prop>`
// Every entry is a reviewed decision with a reason that must survive
// aped-review. A divergence caused by a native bug is FIXED in the
// `.native.tsx` sibling, never listed here. Stale entries fail the suite.
import type { ParityTheme, TextStyleDiff } from "@pekulo/ui/parity";

export const PARITY_ALLOWED_DIVERGENCE: Record<string, string> = {};

export function divergenceKey(
  caseId: string,
  theme: ParityTheme,
  diff: Pick<TextStyleDiff, "text" | "occurrence" | "prop">,
): string {
  return `${caseId}|${theme}|${diff.text}#${diff.occurrence}|${diff.prop}`;
}
