// apps/web/src/app/(spike)/tamagui-spike/tokens.ts
// Pekulo design tokens, ported from docs/ux-preview/src/tokens/ for the W2 spike.
// Pure data — no React, no Tamagui imports — so the contrast test (bun:test)
// and the Tamagui config can both consume this file.

export const pekuloColors = {
  dark: {
    surface: {
      bg: "#07090E",
      card: "#0E1117",
      elevated: "#161A22",
      muted: "#1A1F29",
    },
    text: {
      primary: "#F1F5F9",
      secondary: "#CBD5E1",
      tertiary: "#94A3B8",
      muted: "#64748B",
      onAccent: "#042818",
    },
    border: {
      default: "#1E2533",
      strong: "#2A3344",
      focus: "#34D399",
    },
    accent: {
      500: "#10B981",
      400: "#34D399",
    },
    semantic: {
      success: "#34D399",
      warning: "#FBBF24",
      danger: "#F87171",
      info: "#60A5FA",
    },
  },
  light: {
    surface: {
      bg: "#FAFAFA",
      card: "#FFFFFF",
      elevated: "#FFFFFF",
      muted: "#F1F5F9",
    },
    text: {
      primary: "#0F172A",
      secondary: "#334155",
      tertiary: "#475569",
      muted: "#64748B",
      onAccent: "#FFFFFF",
    },
    border: {
      default: "#E2E8F0",
      strong: "#CBD5E1",
      focus: "#059669",
    },
    accent: {
      500: "#059669",
      600: "#047857",
    },
    semantic: {
      success: "#059669",
      warning: "#D97706",
      danger: "#DC2626",
      info: "#2563EB",
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
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type PekuloMode = keyof typeof pekuloColors;
