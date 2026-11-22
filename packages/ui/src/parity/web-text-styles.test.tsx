// packages/ui/src/parity/web-text-styles.test.tsx
// Story 10-5 AC-2 — freezes the resolved web text styles of every parity case
// in both themes into __baseline__/web-text-styles.json. The native parity
// test (apps/mobile/__tests__/ds-token-parity.test.tsx) compares against it.
//
// AC-2 (verbatim from story 10-5-mobile-parity-and-maestro:17):
//   Given every catalog case rendered on web in the `pekulo-dark` and `pekulo-light`
//   themes, When the design-system test suite runs, Then each text node's colour,
//   font size, font weight, and letter spacing are resolved to concrete values and
//   compared with a committed web reference baseline, and any difference fails the
//   suite until the baseline is deliberately regenerated and reviewed.
//
// Resolution chain per Tamagui text node (`.is_Text`):
//   atomic class (`_col-success`) → injected rule `:root ._col-success`
//   → `color: var(--success)` → value from config.themes[theme] / config.tokens
//   / the `:root .font_<name>` variable rule → normalised value.
// Nested `.is_Text` ancestors are merged first (CSS inheritance, mirrors RN
// nested <Text>).
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";

import { config } from "../config/tamagui";
import { PARITY_CASES } from "./cases";
import { normalizeColor, normalizeFontWeight, normalizeNumber } from "./text-styles";
import {
  PARITY_THEMES,
  type ParityBaseline,
  type ParityTheme,
  type TextStyleRecord,
} from "./types";

const CSS_PROPS = ["color", "font-size", "font-weight", "letter-spacing"] as const;
type CssProp = (typeof CSS_PROPS)[number];
type Declarations = Array<[string, string]>;
type VariableEntry = { val?: unknown; variable?: unknown };

const tamaguiConfig = config as unknown as {
  tokens: Record<string, Record<string, VariableEntry>>;
  themes: Record<string, Record<string, VariableEntry>>;
};

function styleRules(): CSSStyleRule[] {
  const rules: CSSStyleRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      const candidate = rule as CSSStyleRule;
      if (typeof candidate.selectorText === "string") rules.push(candidate);
    }
  }
  return rules;
}

function declarations(rule: CSSStyleRule): Declarations {
  return rule.style.cssText
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":");
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string];
    });
}

/** `_col-success` → declarations of `:root ._col-success`. */
function atomicRules(rules: CSSStyleRule[]): Map<string, Declarations> {
  const map = new Map<string, Declarations>();
  for (const rule of rules) {
    for (const selector of rule.selectorText.split(",")) {
      const match = /^(?::root )?\.([A-Za-z0-9_-]+)$/.exec(selector.trim());
      if (match?.[1]) map.set(match[1], declarations(rule));
    }
  }
  return map;
}

function addVariable(vars: Map<string, string>, entry: VariableEntry | unknown): void {
  if (!entry || typeof entry !== "object") return;
  const { val, variable } = entry as VariableEntry;
  const name = /var\(--([^)]+)\)/.exec(typeof variable === "string" ? variable : "")?.[1];
  if (!name || val === undefined) return;
  vars.set(name, typeof val === "number" ? `${val}px` : String(val));
}

function variablesFor(theme: string, fontName: string, rules: CSSStyleRule[]): Map<string, string> {
  const vars = new Map<string, string>();
  for (const group of Object.values(tamaguiConfig.tokens)) {
    for (const entry of Object.values(group)) addVariable(vars, entry);
  }
  for (const entry of Object.values(tamaguiConfig.themes[theme] ?? {})) addVariable(vars, entry);
  const fontSelector = `:root .font_${fontName}`;
  for (const rule of rules) {
    const selectors = rule.selectorText.split(",").map((s) => s.trim());
    if (!selectors.includes(fontSelector)) continue;
    for (const [prop, value] of declarations(rule)) {
      if (prop.startsWith("--")) vars.set(prop.slice(2), value);
    }
  }
  return vars;
}

function resolveValue(raw: string, vars: Map<string, string>, depth = 0): string {
  const match = /^var\(--([^),\s]+)\s*(?:,\s*([^)]*))?\)$/.exec(raw.trim());
  if (!match?.[1] || depth > 5) return raw.trim();
  const next = vars.get(match[1]) ?? match[2];
  return next === undefined ? raw.trim() : resolveValue(next, vars, depth + 1);
}

function classSuffix(
  el: Element,
  prefix: string,
  accept: (name: string) => boolean,
): string | null {
  let current: Element | null = el;
  while (current) {
    for (const cls of Array.from(current.classList)) {
      if (cls.startsWith(prefix) && accept(cls.slice(prefix.length)))
        return cls.slice(prefix.length);
    }
    current = current.parentElement;
  }
  return null;
}

function ownText(el: Element): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) text += node.textContent ?? "";
  }
  return text.replace(/\s+/g, " ").trim();
}

function ownDeclarations(
  el: Element,
  atomic: Map<string, Declarations>,
): Partial<Record<CssProp, string>> {
  const out: Partial<Record<CssProp, string>> = {};
  for (const cls of Array.from(el.classList)) {
    for (const [prop, value] of atomic.get(cls) ?? []) {
      if ((CSS_PROPS as readonly string[]).includes(prop)) out[prop as CssProp] = value;
    }
  }
  const inline = (el as HTMLElement).style;
  for (const prop of CSS_PROPS) {
    const value = inline?.getPropertyValue(prop);
    if (value) out[prop] = value.trim();
  }
  return out;
}

function extract(container: HTMLElement, fallbackTheme: ParityTheme): TextStyleRecord[] {
  const rules = styleRules();
  const atomic = atomicRules(rules);
  const records: TextStyleRecord[] = [];
  for (const el of Array.from(container.querySelectorAll(".is_Text"))) {
    const text = ownText(el);
    if (text === "") continue;
    const theme = classSuffix(el, "t_", (name) => name in tamaguiConfig.themes) ?? fallbackTheme;
    const fontName = classSuffix(el, "font_", () => true) ?? "body";
    const vars = variablesFor(theme, fontName, rules);
    const chain: Element[] = [];
    let current: Element | null = el;
    while (current) {
      if (current.classList.contains("is_Text")) chain.unshift(current);
      current = current.parentElement;
    }
    const merged: Partial<Record<CssProp, string>> = {};
    for (const node of chain) Object.assign(merged, ownDeclarations(node, atomic));
    const resolved = (prop: CssProp): string | null =>
      merged[prop] === undefined ? null : resolveValue(merged[prop] as string, vars);
    records.push({
      text,
      color: normalizeColor(resolved("color")),
      fontSize: normalizeNumber(resolved("font-size")),
      fontWeight: normalizeFontWeight(resolved("font-weight")),
      letterSpacing: normalizeNumber(resolved("letter-spacing")),
    });
  }
  return records;
}

describe("web text-style baseline (story 10-5)", () => {
  // PekuloErrorBoundary.fallback throws on purpose; React logs it.
  const consoleError = vi.spyOn(console, "error");
  beforeAll(() => {
    consoleError.mockImplementation(() => {});
  });
  afterAll(() => {
    consoleError.mockRestore();
  });

  it("freezes resolved text styles for every parity case in both themes", async () => {
    const baseline: ParityBaseline = {};
    for (const parityCase of PARITY_CASES) {
      const perTheme = {} as Record<ParityTheme, TextStyleRecord[]>;
      for (const theme of PARITY_THEMES) {
        const view = render(
          <TamaguiProvider config={config} defaultTheme={theme}>
            {parityCase.render()}
          </TamaguiProvider>,
        );
        perTheme[theme] = extract(view.container, theme);
        view.unmount();
      }
      baseline[parityCase.id] = perTheme;
    }
    // Guard: the extractor must see real text, or the baseline is vacuous.
    expect(baseline["PekuloStat.gain"]?.["pekulo-dark"]).toEqual([
      {
        text: "Net",
        color: normalizeColor(String(tamaguiConfig.themes["pekulo-dark"]?.colorTertiary?.val)),
        fontSize: 12,
        fontWeight: null,
        letterSpacing: 0.5,
      },
      {
        text: "+1 050 €",
        color: normalizeColor(String(tamaguiConfig.themes["pekulo-dark"]?.success?.val)),
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: null,
      },
    ]);
    await expect(`${JSON.stringify(baseline, null, 2)}\n`).toMatchFileSnapshot(
      "./__baseline__/web-text-styles.json",
    );
  });
});
