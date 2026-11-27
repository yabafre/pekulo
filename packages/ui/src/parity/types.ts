// packages/ui/src/parity/types.ts
// Story 10-5 — shared types for the web ↔ native text-style parity gate.
// Imported by the web baseline test (vitest), the native parity test (Jest),
// and the mobile DS gallery route. Plain types only — no platform code.
import type { ReactElement } from "react";

export type ParityTheme = "pekulo-dark" | "pekulo-light";

export const PARITY_THEMES: readonly ParityTheme[] = ["pekulo-dark", "pekulo-light"];

export interface ParityCase {
  /** Stable id `<Component>.<variant>` — deep-link segment, golden file name, baseline key. */
  id: string;
  /** Folder name under `packages/ui/src/components/` this case covers. */
  component: string;
  /** Exactly one case per component is the iOS golden captured by the Maestro ds-gallery flow. */
  golden: boolean;
  render: () => ReactElement;
}

/** Resolved text style of one rendered text node (null = the platform sets nothing). */
export interface TextStyleRecord {
  text: string;
  color: string | null;
  fontSize: number | null;
  fontWeight: string | null;
  letterSpacing: number | null;
}

/** `web-text-styles.json` shape: case id → theme → text nodes in document order. */
export type ParityBaseline = Record<string, Record<ParityTheme, TextStyleRecord[]>>;
