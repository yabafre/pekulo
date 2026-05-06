// docs/ux-preview/src/tokens/colors.ts
// Strict TS mirror of docs/ux-preview/src/index.css `:root` and `.light`
// blocks (Trade Republic fidelity layer). Every value below is a 1:1 port
// of an `--xxx` CSS var declared in index.css. The CSS file remains the
// rendering SSOT (consumed by App.tsx through Tailwind v4 `@theme`); this
// TS export is for code paths that need typed access to the same tokens
// (build-time tooling, contrast tests, port files like the Tamagui spike).
//
// Contract: when a value diverges from index.css, fix index.css first and
// re-mirror here. Never edit values here in isolation.
//
// Discipline reminders (cf. index.css header):
//   - Background = pure #000 in dark, pure #FFF in light
//   - Cards barely darker than bg, NO borders
//   - Chrome (focus, neutral text) = grayscale only
//   - Color (gain/loss/data-blue) = reserved for performance deltas and
//     the single analytics-donut indicator. NEVER body text.

export const colors = {
  dark: {
    surface: {
      bg: "#000000",
      card: "#0a0a0a",
      elevated: "#121212",
      muted: "#161616",
      overlay: "rgba(0, 0, 0, 0.82)",
    },
    text: {
      primary: "#ededed",
      secondary: "#a1a1a1",
      tertiary: "#707070",
      muted: "#4d4d4d",
    },
    border: {
      default: "rgba(255, 255, 255, 0.10)",
      strong: "rgba(255, 255, 255, 0.16)",
      focus: "#ededed",
    },
    // Performance deltas — the ONLY chromatic accents in TR-strict UI
    perf: {
      gain: "#00d26a",
      gainSoft: "rgba(0, 210, 106, 0.12)",
      loss: "#ff5c5c",
      lossSoft: "rgba(255, 92, 92, 0.12)",
      neutral: "#b3b3b3",
    },
    // Single tiny data-indicator blue — TR's analytics-donut exception
    dataBlue: "#2f73ff",
    donut: {
      track: "rgba(255, 255, 255, 0.08)",
      fill: "#ffffff",
    },
    // Strict grayscale + 1 white actual line
    chart: {
      actual: "#ffffff",
      plan: "rgba(255, 255, 255, 0.32)",
      projection: "rgba(255, 255, 255, 0.16)",
      grid: "rgba(255, 255, 255, 0.06)",
    },
  },
  light: {
    surface: {
      bg: "#ffffff",
      card: "#fafafa",
      elevated: "#ffffff",
      muted: "#f2f2f2",
      overlay: "rgba(255, 255, 255, 0.78)",
    },
    text: {
      primary: "#0a0a0a",
      secondary: "#404040",
      tertiary: "#737373",
      muted: "#a3a3a3",
    },
    border: {
      default: "rgba(0, 0, 0, 0.08)",
      strong: "rgba(0, 0, 0, 0.14)",
      focus: "#0a0a0a",
    },
    perf: {
      gain: "#00a852",
      gainSoft: "rgba(0, 168, 82, 0.10)",
      loss: "#dc2626",
      lossSoft: "rgba(220, 38, 38, 0.08)",
      neutral: "#525252",
    },
    // dataBlue is declared only in `:root` of index.css (not redefined in
    // `.light`) — CSS inheritance keeps it identical in both modes.
    dataBlue: "#2f73ff",
    donut: {
      track: "rgba(0, 0, 0, 0.08)",
      fill: "#0a0a0a",
    },
    chart: {
      actual: "#0a0a0a",
      plan: "rgba(10, 10, 10, 0.32)",
      projection: "rgba(10, 10, 10, 0.16)",
      grid: "rgba(10, 10, 10, 0.06)",
    },
  },
} as const;

export type ColorMode = keyof typeof colors;
