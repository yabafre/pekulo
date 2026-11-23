// apps/mobile/__tests__/ds-token-parity.test.tsx
// Story 10-5 AC-3 — every parity case rendered natively must reproduce the
// web text styles frozen in packages/ui/src/parity/__baseline__/web-text-styles.json
// (colour, size, weight, letter-spacing), in both themes.
//
// AC-3 (verbatim from story 10-5-mobile-parity-and-maestro:18):
//   Given the committed web reference baseline, When the mobile test suite renders
//   every catalog case natively in both themes, Then every web text node exists
//   natively with the same text and, for every property the web sets, the same value;
//   a missing node, an extra native node, or a value mismatch fails with a message
//   naming the case, theme, text, occurrence, and property — unless that exact
//   divergence is on a reviewed allow-list with a written reason, and the suite also
//   fails when an allow-list entry no longer matches any divergence.
//
// Native inheritance mirrors React Native: a <Text> inherits from ancestor
// <Text> only; a <View> resets inheritance.
import { PekuloRootProvider } from "@pekulo/ui";
import {
  PARITY_CASES,
  PARITY_THEMES,
  diffTextStyles,
  normalizeColor,
  normalizeFontWeight,
  normalizeNumber,
  type ParityBaseline,
  type ParityCase,
  type ParityTheme,
  type TextStyleRecord,
} from "@pekulo/ui/parity";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import baselineJson from "../../../packages/ui/src/parity/__baseline__/web-text-styles.json";
import { PARITY_ALLOWED_DIVERGENCE, divergenceKey } from "./helpers/parity-allowlist";

type HostNode = {
  type: string;
  props: Record<string, unknown>;
  children: Array<HostNode | string> | null;
};

const baseline = baselineJson as ParityBaseline;
const originalMatchMedia = (window as unknown as { matchMedia?: unknown }).matchMedia;

function definedStyleProps(style: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function collectTextRecords(
  node: HostNode | HostNode[] | string | null,
  inherited: Record<string, unknown>,
  out: TextStyleRecord[],
): void {
  if (node === null || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const child of node) collectTextRecords(child, inherited, out);
    return;
  }
  const isText = node.type === "Text";
  const own = isText
    ? definedStyleProps(
        (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>,
      )
    : {};
  const merged = isText ? { ...inherited, ...own } : {};
  if (isText) {
    const text = (node.children ?? [])
      .filter((child): child is string => typeof child === "string")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text !== "") {
      out.push({
        text,
        color: normalizeColor(typeof merged.color === "string" ? merged.color : null),
        fontSize: normalizeNumber(merged.fontSize),
        fontWeight: normalizeFontWeight(merged.fontWeight),
        letterSpacing: normalizeNumber(merged.letterSpacing),
      });
    }
  }
  for (const child of node.children ?? []) collectTextRecords(child, merged, out);
}

// Same reduced-motion contract as packages/ui/test/setup.tsx: count-ups and
// the donut sweep render settled at their target, matching the web baseline.
beforeAll(() => {
  (window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query) => ({
    matches: /prefers-reduced-motion/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  // PekuloErrorBoundary.fallback throws on purpose; React logs it.
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  if (originalMatchMedia === undefined) {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  } else {
    (window as unknown as { matchMedia?: unknown }).matchMedia = originalMatchMedia;
  }
  jest.restoreAllMocks();
});

describe("@pekulo/ui web ↔ native text-style parity (story 10-5, AC-3)", () => {
  it("has a web baseline entry for every parity case", () => {
    expect(PARITY_CASES.map((c) => c.id).filter((id) => !(id in baseline))).toEqual([]);
  });

  async function checkCaseTheme(
    parityCase: ParityCase,
    theme: ParityTheme,
    unexpected: string[],
    seenForCase: Set<string>,
  ): Promise<void> {
    const view = await render(
      <PekuloRootProvider theme={theme}>{parityCase.render()}</PekuloRootProvider>,
    );
    const records: TextStyleRecord[] = [];
    collectTextRecords(view.toJSON() as HostNode | HostNode[] | null, {}, records);
    await view.unmount();
    for (const diff of diffTextStyles(baseline[parityCase.id]?.[theme] ?? [], records)) {
      const key = divergenceKey(parityCase.id, theme, diff);
      if (key in PARITY_ALLOWED_DIVERGENCE) {
        seenForCase.add(key);
      } else {
        unexpected.push(
          `${key} — web=${JSON.stringify(diff.web)} native=${JSON.stringify(diff.native)}`,
        );
      }
    }
  }

  it.each(PARITY_CASES.map((c) => [c.id, c] as [string, ParityCase]))(
    "%s renders the web text styles natively in both themes",
    async (_id, parityCase) => {
      const unexpected: string[] = [];
      const seenForCase = new Set<string>();
      await PARITY_THEMES.reduce(
        (chain, theme) =>
          chain.then(() => checkCaseTheme(parityCase, theme, unexpected, seenForCase)),
        Promise.resolve(),
      );
      expect(unexpected).toEqual([]);
      // Per-case staleness check stays order-independent under `-t` and `--randomize`.
      const expectedForCase = Object.keys(PARITY_ALLOWED_DIVERGENCE).filter((key) =>
        key.startsWith(`${parityCase.id}|`),
      );
      expect(expectedForCase.filter((key) => !seenForCase.has(key))).toEqual([]);
    },
  );

  it("validates every allow-list key and requires a written reason", () => {
    const validCaseIds = new Set(PARITY_CASES.map((c) => c.id));
    const validThemes = new Set<string>(PARITY_THEMES);
    for (const [key, reason] of Object.entries(PARITY_ALLOWED_DIVERGENCE)) {
      const [caseId, theme] = key.split("|");
      expect(validCaseIds.has(caseId ?? "")).toBe(true);
      expect(validThemes.has(theme ?? "")).toBe(true);
      expect(`${key}: ${reason.trim()}`).not.toBe(`${key}: `);
    }
  });
});
