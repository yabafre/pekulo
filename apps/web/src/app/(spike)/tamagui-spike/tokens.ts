// apps/web/src/app/(spike)/tamagui-spike/tokens.ts
// Pekulo design tokens — ported from docs/ux-preview/src/index.css (TR-strict
// Trade Republic fidelity layer). NOT from docs/ux-preview/src/tokens/colors.ts
// — that file uses a Tailwind slate palette and is a legacy/orphan SSOT, never
// consumed visually by App.tsx. Real ux-preview rendering goes through Tailwind
// v4 @theme → CSS vars in index.css.
//
// Discipline contract (mémoire feedback_trade_republic_fidelity):
//   - Background = pure #000 in dark, pure #FFF in light
//   - Cards = barely darker than bg (no borders, no decoration)
//   - Chrome (focus, neutral text) = grayscale only
//   - Color (emerald/red) = reserved for performance deltas ONLY
//
// Pure data — no React, no Tamagui imports — so the contrast test (bun:test)
// and the Tamagui config can both consume this file.

export const pekuloColors = {
  dark: {
    surface: {
      bg: "#000000",
      card: "#0a0a0a",
      elevated: "#121212",
      muted: "#161616",
    },
    text: {
      primary: "#ededed",
      secondary: "#a1a1a1",
      tertiary: "#707070",
      muted: "#4d4d4d",
      // onAccent — text color on a gain (#00d26a) surface. TR doesn't put text
      // on emerald (emerald IS the text), but Tamagui needs the slot. Pick #000
      // for max contrast against gain.
      onAccent: "#000000",
    },
    border: {
      // Hairline whites (Vercel signature) — direct port of index.css
      // --border-default / --border-strong / --border-focus.
      default: "rgba(255, 255, 255, 0.10)",
      strong: "rgba(255, 255, 255, 0.16)",
      focus: "#ededed",
    },
    accent: {
      // 500 = TR gain (perf-delta emerald). 400 left identical: TR doesn't
      // define a separate hover shade — the consuming `accentHover` token in
      // tamagui.config.ts is a Tamagui theme requirement, not a brand decision.
      500: "#00d26a",
      400: "#00d26a",
    },
    semantic: {
      success: "#00d26a", // = gain
      // TR-strict has NO warning color. index.css doesn't define one. Kept for
      // Tamagui theme completeness but not surfaced in HeroBlock; revisit when
      // a UI affordance for warnings actually lands.
      warning: "#FBBF24",
      danger: "#ff5c5c", // = loss
      info: "#2f73ff", // = data-blue (TR analytics-donut exception)
    },
  },
  light: {
    surface: {
      bg: "#ffffff",
      card: "#fafafa",
      elevated: "#ffffff",
      muted: "#f2f2f2",
    },
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
    accent: {
      500: "#00a852", // gain in light mode (index.css)
      600: "#00a852", // no separate dark variant in index.css
    },
    semantic: {
      success: "#00a852",
      warning: "#D97706", // see dark.semantic.warning note — no TR equivalent
      danger: "#dc2626", // = loss
      info: "#2f73ff", // data-blue (declared in :root, inherited in .light)
    },
  },
} as const;

export const pekuloSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const pekuloRadius = {
  none: 0,
  sm: 6, // index.css --radius-sm
  md: 8, // index.css --radius-md
  lg: 12, // index.css --radius-lg (default card)
  xl: 16, // index.css --radius-xl (hero)
  full: 9999,
} as const;

export type PekuloMode = keyof typeof pekuloColors;
