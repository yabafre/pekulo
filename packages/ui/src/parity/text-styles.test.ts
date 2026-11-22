// packages/ui/src/parity/text-styles.test.ts
// AC-2 (verbatim from story 10-5-mobile-parity-and-maestro:17):
//   Given every catalog case rendered on web in the `pekulo-dark` and `pekulo-light`
//   themes, When the design-system test suite runs, Then each text node's colour,
//   font size, font weight, and letter spacing are resolved to concrete values and
//   compared with a committed web reference baseline, and any difference fails the
//   suite until the baseline is deliberately regenerated and reviewed.
// AC-3 (verbatim from story 10-5-mobile-parity-and-maestro:18):
//   Given the committed web reference baseline, When the mobile test suite renders
//   every catalog case natively in both themes, Then every web text node exists
//   natively with the same text and, for every property the web sets, the same value;
//   a missing node, an extra native node, or a value mismatch fails with a message
//   naming the case, theme, text, occurrence, and property — unless that exact
//   divergence is on a reviewed allow-list with a written reason, and the suite also
//   fails when an allow-list entry no longer matches any divergence.
import { describe, it, expect } from "vitest";

import {
  diffTextStyles,
  normalizeColor,
  normalizeFontWeight,
  normalizeNumber,
} from "./text-styles";
import type { TextStyleRecord } from "./types";

describe("parity text-style normalisers (story 10-5)", () => {
  it("normalises hex, short hex, 8-digit hex and rgb(a) to one rgba form", () => {
    expect(normalizeColor("#808080")).toBe("rgba(128,128,128,1)");
    expect(normalizeColor("#FFF")).toBe("rgba(255,255,255,1)");
    expect(normalizeColor("#00000080")).toBe("rgba(0,0,0,0.502)");
    expect(normalizeColor("rgb(128, 128, 128)")).toBe("rgba(128,128,128,1)");
    expect(normalizeColor("rgba(0,0,0,0.5)")).toBe("rgba(0,0,0,0.5)");
    expect(normalizeColor("transparent")).toBe("rgba(0,0,0,0)");
    expect(normalizeColor(null)).toBeNull();
    expect(normalizeColor("")).toBeNull();
  });

  it("normalises px strings, numbers, and keyword font weights", () => {
    expect(normalizeNumber("12px")).toBe(12);
    expect(normalizeNumber(0.5)).toBe(0.5);
    expect(normalizeNumber("")).toBeNull();
    expect(normalizeNumber(Number.NaN)).toBeNull();
    expect(normalizeFontWeight("bold")).toBe("700");
    expect(normalizeFontWeight("normal")).toBe("400");
    expect(normalizeFontWeight(600)).toBe("600");
    expect(normalizeFontWeight(undefined)).toBeNull();
  });

  it("reports value mismatches, missing and extra nodes, and skips web-unset properties", () => {
    const web: TextStyleRecord[] = [
      {
        text: "Net",
        color: "rgba(128,128,128,1)",
        fontSize: 12,
        fontWeight: null,
        letterSpacing: 0.5,
      },
      { text: "Gone", color: null, fontSize: 14, fontWeight: null, letterSpacing: null },
    ];
    const native: TextStyleRecord[] = [
      {
        text: "Net",
        color: "rgba(128,128,128,1)",
        fontSize: 13,
        fontWeight: "400",
        letterSpacing: 0.5,
      },
      { text: "Extra", color: null, fontSize: null, fontWeight: null, letterSpacing: null },
    ];
    expect(diffTextStyles(web, native)).toEqual([
      { text: "Net", occurrence: 0, prop: "fontSize", web: 12, native: 13 },
      { text: "Gone", occurrence: 0, prop: "missing-on-native", web: web[1], native: null },
      { text: "Extra", occurrence: 0, prop: "extra-on-native", web: null, native: native[1] },
    ]);
  });

  it("matches duplicate texts by occurrence", () => {
    const row = (fontSize: number): TextStyleRecord => ({
      text: "€",
      color: null,
      fontSize,
      fontWeight: null,
      letterSpacing: null,
    });
    expect(diffTextStyles([row(12), row(20)], [row(12), row(18)])).toEqual([
      { text: "€", occurrence: 1, prop: "fontSize", web: 20, native: 18 },
    ]);
  });
});
