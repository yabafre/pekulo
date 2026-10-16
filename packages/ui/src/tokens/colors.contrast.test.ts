// packages/ui/src/tokens/colors.contrast.test.ts
// WCAG 2.2 AA contrast gate (story 11-4, AC-3 / NFR-23) + SSOT parity check.
//
// happy-dom cannot compute effective foreground/background contrast in unit
// component specs, so two things guard NFR-23:
//   1. This mathematical matrix over every token pair in both themes (runs in
//      test-unit on every PR in <50 ms).
//   2. The real-Chromium @axe-core/playwright pass over the 7 priority routes
//      in `apps/web/e2e/axe-routes.spec.ts` (runs in the `axe-a11y` CI job).
import { describe, expect, it } from "vitest";
import { colors as previewColors } from "../../../../docs/ux-preview/src/tokens/colors";
import { pekuloColors, type PekuloMode } from "./colors";

function parseHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Expected 6-digit hex colour, received "${hex}"`);
  }
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function channelLuminance(channel8Bit: number): number {
  const sRGB = channel8Bit / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const MODES: readonly PekuloMode[] = ["dark", "light"];
const ALL_SURFACES = ["bg", "card", "elevated", "muted"] as const;
const PAGE_SURFACES = ["bg", "card"] as const;
const BODY_TEXT_ROLES = ["primary", "secondary", "tertiary"] as const;

describe("pekuloColors WCAG 2.2 AA contrast gate (AC-3, NFR-23)", () => {
  // AC-3 (verbatim from story 11-4-axe-and-wcag-gates, AC-3):
  //   Given the colour tokens of both dark and light themes, When the
  //   design-system contrast suite runs, Then every body-text (primary,
  //   secondary, tertiary) × surface (bg, card, elevated, muted) pair and
  //   every performance/warning (perf.gain, perf.loss, perf.neutral, warning)
  //   × page-surface (bg, card) pair has a WCAG relative luminance contrast
  //   ratio >= 4.5:1 (NFR-23), text.muted on surface.bg is >= 3.0:1, and the
  //   @pekulo/ui colour palette matches the UX preview SSOT 1:1.
  for (const mode of MODES) {
    describe(`${mode} theme`, () => {
      for (const textRole of BODY_TEXT_ROLES) {
        for (const surfaceRole of ALL_SURFACES) {
          it(`text.${textRole} on surface.${surfaceRole} is >= 4.5:1`, () => {
            const fg = pekuloColors[mode].text[textRole];
            const bg = pekuloColors[mode].surface[surfaceRole];
            const ratio = contrastRatio(fg, bg);
            expect(
              ratio,
              `${mode} text.${textRole} (${fg}) on surface.${surfaceRole} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
            ).toBeGreaterThanOrEqual(4.5);
          });
        }
      }

      for (const surfaceRole of PAGE_SURFACES) {
        it(`perf.gain on surface.${surfaceRole} is >= 4.5:1`, () => {
          const fg = pekuloColors[mode].perf.gain;
          const bg = pekuloColors[mode].surface[surfaceRole];
          const ratio = contrastRatio(fg, bg);
          expect(
            ratio,
            `${mode} perf.gain (${fg}) on surface.${surfaceRole} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
          ).toBeGreaterThanOrEqual(4.5);
        });

        it(`perf.loss on surface.${surfaceRole} is >= 4.5:1`, () => {
          const fg = pekuloColors[mode].perf.loss;
          const bg = pekuloColors[mode].surface[surfaceRole];
          const ratio = contrastRatio(fg, bg);
          expect(
            ratio,
            `${mode} perf.loss (${fg}) on surface.${surfaceRole} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
          ).toBeGreaterThanOrEqual(4.5);
        });

        it(`perf.neutral on surface.${surfaceRole} is >= 4.5:1`, () => {
          const fg = pekuloColors[mode].perf.neutral;
          const bg = pekuloColors[mode].surface[surfaceRole];
          const ratio = contrastRatio(fg, bg);
          expect(
            ratio,
            `${mode} perf.neutral (${fg}) on surface.${surfaceRole} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
          ).toBeGreaterThanOrEqual(4.5);
        });

        it(`warning on surface.${surfaceRole} is >= 4.5:1`, () => {
          const fg = pekuloColors[mode].warning;
          const bg = pekuloColors[mode].surface[surfaceRole];
          const ratio = contrastRatio(fg, bg);
          expect(
            ratio,
            `${mode} warning (${fg}) on surface.${surfaceRole} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }

      it("text.muted on surface.bg is >= 3.0:1 (large/decorative threshold)", () => {
        const fg = pekuloColors[mode].text.muted;
        const bg = pekuloColors[mode].surface.bg;
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `${mode} text.muted (${fg}) on surface.bg (${bg}) = ${ratio.toFixed(2)}:1 (< 3.0:1)`,
        ).toBeGreaterThanOrEqual(3.0);
      });
    });
  }

  it("mirrors docs/ux-preview/src/tokens/colors.ts 1:1 on every shared token", () => {
    for (const mode of MODES) {
      expect(pekuloColors[mode].surface).toEqual(previewColors[mode].surface);
      expect({
        primary: pekuloColors[mode].text.primary,
        secondary: pekuloColors[mode].text.secondary,
        tertiary: pekuloColors[mode].text.tertiary,
        muted: pekuloColors[mode].text.muted,
      }).toEqual(previewColors[mode].text);
      expect(pekuloColors[mode].border).toEqual(previewColors[mode].border);
      expect(pekuloColors[mode].perf).toEqual(previewColors[mode].perf);
      expect(pekuloColors[mode].dataBlue).toBe(previewColors[mode].dataBlue);
      expect(pekuloColors[mode].warning).toBe(previewColors[mode].warning);
      expect(pekuloColors[mode].chart).toEqual(previewColors[mode].chart);
      expect(pekuloColors[mode].donut).toEqual(previewColors[mode].donut);
    }
  });
});
