// apps/web/src/app/(spike)/tamagui-spike/contrast.test.ts
// WCAG 2.2 AA contrast preservation test for the W2 spike.
// AC-2 binding: every text/surface pair declared in PAIRS_TO_TEST must clear
// the size-appropriate threshold for both pekulo-dark and pekulo-light.
//
// Run from repo root: bun --filter=web run test:contrast

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it, afterAll } from "bun:test";

import { contrastRatio } from "./contrast";
import { pekuloColors, type PekuloMode } from "./tokens";

type Size = "body" | "large";

interface Pair {
  label: string;
  fgPath: (mode: PekuloMode) => string;
  bgPath: (mode: PekuloMode) => string;
  size: Size;
}

const THRESHOLDS: Record<Size, number> = {
  body: 4.5,
  large: 3.0,
};

const PAIRS_TO_TEST: Pair[] = [
  {
    label: "text.primary on surface.bg",
    fgPath: (m) => pekuloColors[m].text.primary,
    bgPath: (m) => pekuloColors[m].surface.bg,
    size: "body",
  },
  {
    label: "text.primary on surface.card",
    fgPath: (m) => pekuloColors[m].text.primary,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
  {
    label: "text.secondary on surface.card",
    fgPath: (m) => pekuloColors[m].text.secondary,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
  {
    label: "text.tertiary on surface.card",
    fgPath: (m) => pekuloColors[m].text.tertiary,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "large",
  },
  {
    label: "accent.500 on surface.card",
    fgPath: (m) => pekuloColors[m].accent[500],
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
  {
    label: "semantic.danger on surface.card",
    fgPath: (m) => pekuloColors[m].semantic.danger,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
  {
    label: "semantic.warning on surface.card",
    fgPath: (m) => pekuloColors[m].semantic.warning,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
  {
    label: "semantic.info on surface.card",
    fgPath: (m) => pekuloColors[m].semantic.info,
    bgPath: (m) => pekuloColors[m].surface.card,
    size: "body",
  },
];

interface ReportRow {
  theme: PekuloMode;
  pair: string;
  fg: string;
  bg: string;
  size: Size;
  ratio: number;
  threshold: number;
  pass: boolean;
}

const report: ReportRow[] = [];

describe("WCAG 2.2 AA contrast — pekulo-dark", () => {
  for (const pair of PAIRS_TO_TEST) {
    it(`${pair.label} (${pair.size}) ≥ ${THRESHOLDS[pair.size]}`, () => {
      const fg = pair.fgPath("dark");
      const bg = pair.bgPath("dark");
      const ratio = contrastRatio(fg, bg);
      report.push({
        theme: "dark",
        pair: pair.label,
        fg,
        bg,
        size: pair.size,
        ratio,
        threshold: THRESHOLDS[pair.size],
        pass: ratio >= THRESHOLDS[pair.size],
      });
      expect(ratio).toBeGreaterThanOrEqual(THRESHOLDS[pair.size]);
    });
  }
});

describe("WCAG 2.2 AA contrast — pekulo-light", () => {
  for (const pair of PAIRS_TO_TEST) {
    it(`${pair.label} (${pair.size}) ≥ ${THRESHOLDS[pair.size]}`, () => {
      const fg = pair.fgPath("light");
      const bg = pair.bgPath("light");
      const ratio = contrastRatio(fg, bg);
      report.push({
        theme: "light",
        pair: pair.label,
        fg,
        bg,
        size: pair.size,
        ratio,
        threshold: THRESHOLDS[pair.size],
        pass: ratio >= THRESHOLDS[pair.size],
      });
      expect(ratio).toBeGreaterThanOrEqual(THRESHOLDS[pair.size]);
    });
  }
});

afterAll(() => {
  const reportPath = resolve(import.meta.dir, "../../../../../../docs/spikes/0-9-contrast-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), thresholds: THRESHOLDS, rows: report }, null, 2) + "\n");
});
