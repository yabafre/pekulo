// packages/ui/src/tokens/colors.ts
// Pekulo design tokens — TR-strict (Trade Republic fidelity layer). Mirrors
// docs/ux-preview/src/index.css (the runtime SSOT for ux-preview) and
// docs/ux-preview/src/tokens/colors.ts (the typed TS mirror).
//
// Discipline contract (memory feedback_trade_republic_fidelity):
//   - Background = pure #000 in dark, pure #FFF in light
//   - Cards = barely darker than bg (no borders, no decoration)
//   - Chrome (focus, neutral text) = grayscale only
//   - Color (emerald/red) = reserved for performance deltas ONLY
//
// Pure data — no React, no Tamagui imports — so contrast tests, the Tamagui
// config, and consumer code can all consume this file.

export const pekuloColors = {
  dark: {
    surface: { bg: "#000000", card: "#0a0a0a", elevated: "#121212", muted: "#161616" },
    text: {
      primary: "#ededed",
      secondary: "#a1a1a1",
      tertiary: "#707070",
      muted: "#4d4d4d",
      // onAccent — text color on a gain (#00d26a) surface. TR doesn't put text
      // on emerald, but Tamagui's theme slot needs a value. #000 = max contrast.
      onAccent: "#000000",
    },
    border: {
      default: "rgba(255, 255, 255, 0.10)",
      strong: "rgba(255, 255, 255, 0.16)",
      focus: "#ededed",
    },
    accent: { 500: "#00d26a", 400: "#00d26a" },
    semantic: {
      success: "#00d26a",
      warning: "#FBBF24",
      danger: "#ff5c5c",
      info: "#2f73ff",
    },
    // chart series — strict grayscale + 1 white actual line
    chart: {
      actual: "#ffffff",
      plan: "rgba(255, 255, 255, 0.32)",
      projection: "rgba(255, 255, 255, 0.16)",
      grid: "rgba(255, 255, 255, 0.06)",
    },
    donut: { track: "rgba(255, 255, 255, 0.08)", fill: "#ffffff" },
  },
  light: {
    surface: { bg: "#ffffff", card: "#fafafa", elevated: "#ffffff", muted: "#f2f2f2" },
    text: {
      primary: "#0a0a0a",
      secondary: "#404040",
      tertiary: "#737373",
      muted: "#a3a3a3",
      onAccent: "#ffffff",
    },
    border: {
      default: "rgba(0, 0, 0, 0.08)",
      strong: "rgba(0, 0, 0, 0.14)",
      focus: "#0a0a0a",
    },
    accent: { 500: "#00a852", 600: "#00a852" },
    semantic: {
      success: "#00a852",
      warning: "#D97706",
      danger: "#dc2626",
      info: "#2f73ff",
    },
    chart: {
      actual: "#0a0a0a",
      plan: "rgba(10, 10, 10, 0.32)",
      projection: "rgba(10, 10, 10, 0.16)",
      grid: "rgba(10, 10, 10, 0.06)",
    },
    donut: { track: "rgba(0, 0, 0, 0.08)", fill: "#0a0a0a" },
  },
} as const;

export type PekuloMode = keyof typeof pekuloColors;
