// packages/ui/src/tokens/typography.ts
// Pekulo type scale — port from docs/ux/design-spec.md § 2.2.
// Geist + Geist Mono ; weights 400/500/600/700 (no light at V1 — Geist 300
// is not bundled).

export const pekuloFonts = {
  sans: "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

export const pekuloFontSizes = {
  "11": 11,
  xs: 12,
  caption: 13,
  bodySm: 14,
  body: 16,
  h3: 16,
  bodyLg: 17,
  h2: 20,
  h1: 26,
  display: 32,
  hero: 42,
} as const;

export const pekuloFontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const pekuloLineHeights = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const pekuloLetterSpacings = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
} as const;
