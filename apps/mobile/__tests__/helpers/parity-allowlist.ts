// apps/mobile/__tests__/helpers/parity-allowlist.ts
// Story 10-5 AC-3 — accepted web ↔ native text-style divergences.
// Key format (exactly what divergenceKey() prints in a failure):
//   `<caseId>|<theme>|<text>#<occurrence>|<prop>`
// Every entry is a reviewed decision with a reason that must survive
// aped-review. A divergence caused by a native bug is FIXED in the
// `.native.tsx` sibling, never listed here. Stale entries fail the suite.
import type { ParityTheme, TextStyleDiff } from "@pekulo/ui/parity";

const CATEGORY_PICKER_CLOSED_SHEET_REASON =
  'Shared source (no CategoryPicker.native.tsx); PekuloSelect.native.tsx adapts via <TamaSelect.Adapt platform="touch"> and keeps the closed TamaSheet\'s option <Text> nodes mounted off-screen for Select.Value registration (no visual output while closed), whereas web unmounts the closed popover.';

export const PARITY_ALLOWED_DIVERGENCE: Record<string, string> = {
  "CategoryPicker.closed|pekulo-dark|Courses#1|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
  "CategoryPicker.closed|pekulo-dark|Transport#0|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
  "CategoryPicker.closed|pekulo-dark|Restauration#0|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
  "CategoryPicker.closed|pekulo-light|Courses#1|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
  "CategoryPicker.closed|pekulo-light|Transport#0|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
  "CategoryPicker.closed|pekulo-light|Restauration#0|extra-on-native":
    CATEGORY_PICKER_CLOSED_SHEET_REASON,
};

export function divergenceKey(
  caseId: string,
  theme: ParityTheme,
  diff: Pick<TextStyleDiff, "text" | "occurrence" | "prop">,
): string {
  return `${caseId}|${theme}|${diff.text}#${diff.occurrence}|${diff.prop}`;
}
