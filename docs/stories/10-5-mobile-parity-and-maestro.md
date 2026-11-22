# Story: 10-5-mobile-parity-and-maestro — Web ↔ native token-parity gate, iOS DS goldens, and Maestro E2E suite on EAS Workflows (iOS)

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** #156
**Branch:** feature/156-10-5-mobile-parity-and-maestro
**Complexity:** L (re-estimated from M at step-04 — three subsystems: token-parity gate, DS gallery + goldens, EAS CI; kept as one story because the goldens and the gate share the AC-1 catalog)
**Covered FRs:** FR-56 (parity verification & Maestro CI), FR-55 (native DS consumption is now regression-gated)

## User Story

**As a** Pekulo developer, **I want** every `@pekulo/ui` component's text styles (colour, size, weight, letter-spacing) checked against the web rendering on every test run, iOS screenshot goldens of every component, and a Maestro E2E suite running on an iOS Simulator build for every mobile pull request, **so that** visual drift between web and native and navigation breaks are caught before App Store release.

## Acceptance Criteria

- **AC-1 (Shared parity catalog + coverage gate)** — **Given** a parity catalog published by the design-system package through a dedicated `@pekulo/ui/parity` entry point (kept out of the public component barrels), **When** the design-system test suite runs, **Then** it fails unless every design-system component is covered by at least one catalog case (or carries a documented exemption), every case id is unique and of the form `<Component>.<variant>`, every case refers to an existing component, and every covered component has exactly one case designated as its screenshot golden.
- **AC-2 (Web text-style baseline)** — **Given** every catalog case rendered on web in the `pekulo-dark` and `pekulo-light` themes, **When** the design-system test suite runs, **Then** each text node's colour, font size, font weight, and letter spacing are resolved to concrete values and compared with a committed web reference baseline, and any difference fails the suite until the baseline is deliberately regenerated and reviewed.
- **AC-3 (Native token parity)** — **Given** the committed web reference baseline, **When** the mobile test suite renders every catalog case natively in both themes, **Then** every web text node exists natively with the same text and, for every property the web sets, the same value; a missing node, an extra native node, or a value mismatch fails with a message naming the case, theme, text, occurrence, and property — unless that exact divergence is on a reviewed allow-list with a written reason, and the suite also fails when an allow-list entry no longer matches any divergence.
- **AC-4 (In-app DS gallery)** — **Given** a mobile build made with `EXPO_PUBLIC_DS_GALLERY=1`, **When** the deep link `pekulo://ds/<caseId>?theme=<pekulo-dark|pekulo-light>` opens, **Then** the app shows that catalog case alone, in the requested theme (dark by default), inside a container identified as `ds-case-<caseId>`; **And** when the flag is not `1` or the case id is unknown, the app returns to its home screen instead.
- **AC-5 (Maestro suite)** — **Given** the iOS Simulator end-to-end build running in preview mode with no backend, **When** the Maestro suite runs, **Then** the five tabs show their preview figures, Paramètres opens from the Cap header and closes, a mutation attempted in preview mode shows the "Mode aperçu" sign-in prompt and can be dismissed, and every component's golden case matches its committed iOS screenshot at a 98 % similarity threshold — or is captured as a fresh screenshot when golden regeneration is requested; **And** the mobile test suite fails when the committed screenshot flow no longer matches the golden cases of the catalog.
- **AC-6 (EAS Workflows CI)** — **Given** an EAS end-to-end build profile that produces an unsigned iOS Simulator build in preview mode with the DS gallery enabled and the repository's pinned Bun version, **When** a pull request to `main` changes the mobile app or the shared `ui`, `contracts`, `validators`, or `types` packages, **Then** EAS Workflows builds the app and runs the whole Maestro suite with one retry as a non-required check; **And** a manually triggered workflow regenerates the iOS goldens on the same simulator image and exposes them as downloadable artifacts.
- **AC-7 (Docs + quality gates)** — **Given** the finished change, **When** typecheck, lint, format check, the `@pekulo/ui`, `@pekulo/mobile`, and `@pekulo/web` test suites, and the Tamagui stylesheet freshness check run, **Then** every check exits 0 with no change to the existing web component snapshots or the generated stylesheet; **And** the epic plan records the realized 10-5 scope and the new Android sibling story 10-6, the sprint state registers 10-6, the architecture describes the mobile test layer, and the mobile README documents the parity, Maestro, and EAS commands.

## Tasks

Task order is load-bearing: the pure model (T1) and the catalog (T2–T3) come before the web baseline (T4), which must exist before the native gate (T5–T6). The gallery (T7) comes before the Maestro flows (T8–T9) that drive it, and the flows before the EAS wiring (T11). T15 is a user-assisted live run and closes the story. Run every command from the repository root unless the command starts with `cd`.

- [x] **T1 — Parity model: types + normalisers + diff** [AC: AC-2, AC-3]

  Create `packages/ui/src/parity/types.ts`:

  ```ts
  // packages/ui/src/parity/types.ts
  // Story 10-5 — shared types for the web ↔ native text-style parity gate.
  // Imported by the web baseline test (vitest), the native parity test (Jest),
  // and the mobile DS gallery route. Plain types only — no platform code.
  import type { ReactElement } from "react";

  export type ParityTheme = "pekulo-dark" | "pekulo-light";

  export const PARITY_THEMES: readonly ParityTheme[] = ["pekulo-dark", "pekulo-light"];

  export interface ParityCase {
    /** Stable id `<Component>.<variant>` — deep-link segment, golden file name, baseline key. */
    id: string;
    /** Folder name under `packages/ui/src/components/` this case covers. */
    component: string;
    /** Exactly one case per component is the iOS golden captured by the Maestro ds-gallery flow. */
    golden: boolean;
    render: () => ReactElement;
  }

  /** Resolved text style of one rendered text node (null = the platform sets nothing). */
  export interface TextStyleRecord {
    text: string;
    color: string | null;
    fontSize: number | null;
    fontWeight: string | null;
    letterSpacing: number | null;
  }

  /** `web-text-styles.json` shape: case id → theme → text nodes in document order. */
  export type ParityBaseline = Record<string, Record<ParityTheme, TextStyleRecord[]>>;
  ```

  Create `packages/ui/src/parity/text-styles.ts`:

  ```ts
  // packages/ui/src/parity/text-styles.ts
  // Story 10-5 — value normalisers + the web ↔ native diff. Pure functions so
  // both runners (vitest on web, Jest on native) compare with the same rules.
  import type { TextStyleRecord } from "./types";

  export const PARITY_PROPS = ["color", "fontSize", "fontWeight", "letterSpacing"] as const;
  export type ParityProp = (typeof PARITY_PROPS)[number];

  export interface TextStyleDiff {
    text: string;
    /** 0-based index among the nodes that carry the same text. */
    occurrence: number;
    prop: ParityProp | "missing-on-native" | "extra-on-native";
    web: unknown;
    native: unknown;
  }

  function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  /** Any hex / rgb() / rgba() colour → `rgba(r,g,b,a)` (alpha rounded to 3 decimals). */
  export function normalizeColor(input: string | null | undefined): string | null {
    if (input === null || input === undefined) return null;
    const value = String(input).trim().toLowerCase();
    if (value === "") return null;
    if (value === "transparent") return "rgba(0,0,0,0)";
    const hex = /^#([0-9a-f]{3,8})$/.exec(value);
    if (hex) {
      let digits = hex[1];
      if (digits.length === 3 || digits.length === 4) {
        digits = digits
          .split("")
          .map((d) => d + d)
          .join("");
      }
      if (digits.length !== 6 && digits.length !== 8) return value;
      const r = Number.parseInt(digits.slice(0, 2), 16);
      const g = Number.parseInt(digits.slice(2, 4), 16);
      const b = Number.parseInt(digits.slice(4, 6), 16);
      const a = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
      return `rgba(${r},${g},${b},${round3(a)})`;
    }
    const fn = /^rgba?\(([^)]+)\)$/.exec(value);
    if (fn) {
      const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
      const [r, g, b] = parts.slice(0, 3).map((p) => Math.round(Number.parseFloat(p)));
      const rawAlpha = parts[3];
      const a =
        rawAlpha === undefined
          ? 1
          : rawAlpha.endsWith("%")
            ? Number.parseFloat(rawAlpha) / 100
            : Number.parseFloat(rawAlpha);
      return `rgba(${r},${g},${b},${round3(a)})`;
    }
    return value;
  }

  /** `12`, `"12px"`, `"0.5px"` → number (3 decimals); empty / non-finite → null. */
  export function normalizeNumber(input: unknown): number | null {
    if (input === null || input === undefined || input === "") return null;
    if (typeof input === "number") return Number.isFinite(input) ? round3(input) : null;
    const parsed = Number.parseFloat(String(input));
    return Number.isFinite(parsed) ? round3(parsed) : null;
  }

  /** `600` / `"600"` → `"600"`; `normal` → `"400"`; `bold` → `"700"`. */
  export function normalizeFontWeight(input: unknown): string | null {
    if (input === null || input === undefined || input === "") return null;
    const value = String(input).trim();
    if (value === "normal") return "400";
    if (value === "bold") return "700";
    return value;
  }

  function keyed(records: readonly TextStyleRecord[]): Map<string, TextStyleRecord> {
    const counts = new Map<string, number>();
    const out = new Map<string, TextStyleRecord>();
    for (const record of records) {
      const n = counts.get(record.text) ?? 0;
      counts.set(record.text, n + 1);
      out.set(`${record.text}#${n}`, record);
    }
    return out;
  }

  function occurrenceOf(key: string): number {
    return Number(key.slice(key.lastIndexOf("#") + 1));
  }

  /**
   * Compare web (reference) with native text nodes, matched by text + occurrence.
   * A property the web leaves unset (null) is not compared — the web did not
   * specify it, so there is nothing to be at parity with.
   */
  export function diffTextStyles(
    web: readonly TextStyleRecord[],
    native: readonly TextStyleRecord[],
  ): TextStyleDiff[] {
    const webByKey = keyed(web);
    const nativeByKey = keyed(native);
    const diffs: TextStyleDiff[] = [];
    for (const [key, webRecord] of webByKey) {
      const nativeRecord = nativeByKey.get(key);
      if (!nativeRecord) {
        diffs.push({
          text: webRecord.text,
          occurrence: occurrenceOf(key),
          prop: "missing-on-native",
          web: webRecord,
          native: null,
        });
        continue;
      }
      for (const prop of PARITY_PROPS) {
        if (webRecord[prop] === null) continue;
        if (webRecord[prop] !== nativeRecord[prop]) {
          diffs.push({
            text: webRecord.text,
            occurrence: occurrenceOf(key),
            prop,
            web: webRecord[prop],
            native: nativeRecord[prop],
          });
        }
      }
    }
    for (const [key, nativeRecord] of nativeByKey) {
      if (!webByKey.has(key)) {
        diffs.push({
          text: nativeRecord.text,
          occurrence: occurrenceOf(key),
          prop: "extra-on-native",
          web: null,
          native: nativeRecord,
        });
      }
    }
    return diffs;
  }
  ```

  Create `packages/ui/src/parity/text-styles.test.ts`:

  ```ts
  // packages/ui/src/parity/text-styles.test.ts
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
        { text: "Net", color: "rgba(128,128,128,1)", fontSize: 12, fontWeight: null, letterSpacing: 0.5 },
        { text: "Gone", color: null, fontSize: 14, fontWeight: null, letterSpacing: null },
      ];
      const native: TextStyleRecord[] = [
        { text: "Net", color: "rgba(128,128,128,1)", fontSize: 13, fontWeight: "400", letterSpacing: 0.5 },
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
  ```

  Run: `cd packages/ui && bunx vitest run src/parity/text-styles.test.ts`
  Expected: `Test Files  1 passed (1)` and `Tests  4 passed (4)`, exit 0.
  Commit: `git add packages/ui/src/parity/types.ts packages/ui/src/parity/text-styles.ts packages/ui/src/parity/text-styles.test.ts && git commit -m "feat(#156): add parity text-style model and diff"`

- [x] **T2 — Parity catalog, platform-split icons, `@pekulo/ui/parity` subpath** [AC: AC-1, AC-4]

  Create `packages/ui/src/parity/icons.ts` (web — resolved by vitest and `apps/web`):

  ```ts
  // packages/ui/src/parity/icons.ts
  // Web icon set for the parity catalog. The React Native sibling
  // (icons.native.ts) re-exports the same names from lucide-react-native, so
  // cases.tsx stays platform-agnostic.
  export { Check, Monitor, Moon, Sun } from "lucide-react";
  ```

  Create `packages/ui/src/parity/icons.native.ts`:

  ```ts
  // packages/ui/src/parity/icons.native.ts
  // React Native icon set for the parity catalog (resolved by Metro / Jest /
  // apps/mobile tsconfig moduleSuffixes). Same names as icons.ts.
  export { Check, Monitor, Moon, Sun } from "lucide-react-native";
  ```

  Create `packages/ui/src/parity/cases.tsx` (props mirror the 10-1 snapshot tests so the web baseline describes the same renders the 10-1 snapshots freeze):

  ```tsx
  // packages/ui/src/parity/cases.tsx
  // Story 10-5 — the shared web ↔ native parity catalog. One entry per render
  // to compare; exactly one `golden: true` entry per component is captured as
  // an iOS screenshot golden by the Maestro ds-gallery flow.
  //
  // Platform-agnostic by construction: components are imported from their
  // folders (Metro / Jest / TS moduleSuffixes resolve the `.native.tsx`
  // siblings on React Native), icons come from ./icons (split per platform),
  // children use Tamagui `Text`, and callbacks are no-ops. NEVER import from
  // "lucide-react", "react-dom", or HTML elements here.
  //
  // NOT re-exported from src/index.ts / src/index.native.ts — consumed only via
  // the `@pekulo/ui/parity` subpath (tests + the mobile DS gallery).
  import type { ReactElement } from "react";
  import { Text } from "tamagui";

  import { CategoryIcon } from "../components/CategoryIcon";
  import { CategoryPicker } from "../components/CategoryPicker";
  import { PekuloAccountRow } from "../components/PekuloAccountRow";
  import { PekuloAccountsSection } from "../components/PekuloAccountsSection";
  import { PekuloActivityRow } from "../components/PekuloActivityRow";
  import { PekuloClassRow } from "../components/PekuloClassRow";
  import { PekuloCompositionCard } from "../components/PekuloCompositionCard";
  import { PekuloCompositionRow } from "../components/PekuloCompositionRow";
  import { PekuloContextualAddButton } from "../components/PekuloContextualAddButton";
  import { PekuloCountUpEUR } from "../components/PekuloCountUpEUR";
  import { PekuloCountUpPct } from "../components/PekuloCountUpPct";
  import { PekuloDonut } from "../components/PekuloDonut";
  import { PekuloDonutCard } from "../components/PekuloDonutCard";
  import { PekuloEmptyState } from "../components/PekuloEmptyState";
  import { PekuloErrorBoundary } from "../components/PekuloErrorBoundary";
  import { PekuloHero } from "../components/PekuloHero";
  import { PekuloHeroCard } from "../components/PekuloHeroCard";
  import { PekuloHoldingRow } from "../components/PekuloHoldingRow";
  import { PekuloHypothesisCard } from "../components/PekuloHypothesisCard";
  import { PekuloHypothesisVerdict } from "../components/PekuloHypothesisVerdict";
  import { PekuloKpiTile } from "../components/PekuloKpiTile";
  import { PekuloMilestoneRow } from "../components/PekuloMilestoneRow";
  import { PekuloMilestonesCard } from "../components/PekuloMilestonesCard";
  import { PekuloMobileBottomNav } from "../components/PekuloMobileBottomNav";
  import { PekuloMonthlyRow } from "../components/PekuloMonthlyRow";
  import { PekuloNavRail } from "../components/PekuloNavRail";
  import { PekuloPagination } from "../components/PekuloPagination";
  import { PekuloProjectionChart } from "../components/PekuloProjectionChart";
  import { PekuloPropertyCard } from "../components/PekuloPropertyCard";
  import { PekuloRecentActivityCard } from "../components/PekuloRecentActivityCard";
  import { PekuloSegmentedControl } from "../components/PekuloSegmentedControl";
  import { PekuloSettingRow } from "../components/PekuloSettingRow";
  import { PekuloSkeleton } from "../components/PekuloSkeleton";
  import { PekuloStaggerList } from "../components/PekuloStaggerList";
  import { PekuloStat } from "../components/PekuloStat";
  import { PekuloSuggestionRow } from "../components/PekuloSuggestionRow";
  import { PekuloToggleRow } from "../components/PekuloToggleRow";
  import { PekuloTopTabToggle } from "../components/PekuloTopTabToggle";
  import { PekuloTrajectoryCard } from "../components/PekuloTrajectoryCard";
  import { PekuloTrajectoryChart } from "../components/PekuloTrajectoryChart";
  import { PekuloUserDot } from "../components/PekuloUserDot";
  import { TransactionLogo } from "../components/TransactionLogo";
  import { Check, Monitor, Moon, Sun } from "./icons";
  import type { ParityCase } from "./types";

  const noop = (): void => {};

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  /** Throws on render so PekuloErrorBoundary shows its default fallback. */
  function ParityBoom(): never {
    throw new Error("kaboom");
  }

  function parityCase(
    component: string,
    variant: string,
    golden: boolean,
    render: () => ReactElement,
  ): ParityCase {
    return { id: `${component}.${variant}`, component, golden, render };
  }

  /**
   * Components deliberately left out of the catalog, with the reason. An entry
   * here is a reviewed decision, never a convenience (same rule as
   * ds-coverage.meta.test.ts). Empty at story 10-5: all 42 are covered.
   */
  export const PARITY_EXEMPT_COMPONENTS: Record<string, string> = {};

  export const PARITY_CASES: readonly ParityCase[] = [
    parityCase("CategoryIcon", "known", true, () => <CategoryIcon category="courses" />),
    parityCase("CategoryPicker", "closed", true, () => (
      <CategoryPicker
        value="courses"
        onValueChange={noop}
        options={[
          { value: "courses", label: "Courses" },
          { value: "transport", label: "Transport" },
          { value: "restauration", label: "Restauration" },
        ]}
      />
    )),
    parityCase("PekuloAccountRow", "default", true, () => (
      <PekuloAccountRow label="PEA Bourso" type="pea" institution="Boursorama" balanceEur={45200} />
    )),
    parityCase("PekuloAccountsSection", "three", true, () => (
      <PekuloAccountsSection
        accounts={[
          { label: "Livret A", type: "livret", institution: "Bourso", balanceEur: 15000 },
          { label: "PEA Bourso", type: "pea", institution: "Boursorama", balanceEur: 45200 },
          { label: "CTO", type: "cto", balanceEur: 12000 },
        ]}
      />
    )),
    parityCase("PekuloActivityRow", "inflow", true, () => (
      <PekuloActivityRow
        tx={{
          label: "Salaire",
          account: "Compte courant",
          category: "Revenus",
          direction: "in",
          amountEur: 3200,
        }}
      />
    )),
    parityCase("PekuloActivityRow", "outflow", false, () => (
      <PekuloActivityRow
        tx={{ label: "Carrefour", account: "CB", category: "Courses", direction: "out", amountEur: 87 }}
      />
    )),
    parityCase("PekuloClassRow", "default", true, () => (
      <PekuloClassRow label="ETF" amountEur={62000} pct={0.55} />
    )),
    parityCase("PekuloCompositionCard", "three", true, () => (
      <PekuloCompositionCard
        items={[
          { id: "etf", label: "ETF", amount: 92400, pct: 0.51, sub: "Marchés mondiaux" },
          { id: "crypto", label: "Crypto", amount: 12800, pct: 0.07 },
          { id: "cash", label: "Cash", amount: 41200, pct: 0.23 },
        ]}
      />
    )),
    parityCase("PekuloCompositionRow", "withSub", true, () => (
      <PekuloCompositionRow label="Placements" amount={89000} pct={0.49} sub="ETF + Actions + Crypto" />
    )),
    parityCase("PekuloContextualAddButton", "default", true, () => (
      <PekuloContextualAddButton label="Ajouter une transaction" onPress={noop} />
    )),
    parityCase("PekuloCountUpEUR", "integer", true, () => <PekuloCountUpEUR value={180400} />),
    parityCase("PekuloCountUpEUR", "precise", false, () => <PekuloCountUpEUR value={87.42} precise />),
    parityCase("PekuloCountUpPct", "default", true, () => <PekuloCountUpPct value={0.42} />),
    parityCase("PekuloCountUpPct", "precise", false, () => <PekuloCountUpPct value={0.728} precise />),
    parityCase("PekuloDonut", "plain", false, () => <PekuloDonut pct={0.5} />),
    parityCase("PekuloDonut", "centered", true, () => <PekuloDonut pct={0.72} centered />),
    parityCase("PekuloDonutCard", "default", true, () => (
      <PekuloDonutCard title="Compass" pct={0.42} centered />
    )),
    parityCase("PekuloEmptyState", "withCta", true, () => (
      <PekuloEmptyState
        icon={Check}
        title="Pas de cap"
        message="Définis un cap pour commencer."
        ctaLabel="Définir un cap"
        onCta={noop}
      />
    )),
    parityCase("PekuloEmptyState", "noCta", false, () => (
      <PekuloEmptyState icon={Check} title="Tout est catégorisé" message="Aucune transaction en attente." />
    )),
    parityCase("PekuloErrorBoundary", "fallback", true, () => (
      <PekuloErrorBoundary>
        <ParityBoom />
      </PekuloErrorBoundary>
    )),
    parityCase("PekuloHero", "mobile", true, () => <PekuloHero totalEur={180400} aheadEur={21383} />),
    parityCase("PekuloHero", "card", false, () => (
      <PekuloHero
        variant="card"
        totalEur={180400}
        aheadEur={21383}
        targetCapital={800000}
        targetYear={2055}
        requiredYearlyEur={21383}
      />
    )),
    parityCase("PekuloHero", "negative", false, () => <PekuloHero totalEur={140000} aheadEur={-5000} />),
    parityCase("PekuloHeroCard", "default", true, () => (
      <PekuloHeroCard
        totalEur={180400}
        aheadEur={2400}
        targetCapital={500000}
        targetYear={2055}
        requiredYearlyEur={21400}
      />
    )),
    parityCase("PekuloHoldingRow", "gain", true, () => (
      <PekuloHoldingRow
        holding={{
          ticker: "CW8.PA",
          label: "MSCI World",
          account: "PEA",
          kind: "etf",
          quantity: 142,
          pricePerUnit: 532.5,
          marketValueEur: 75615,
          pnlEur: 8420,
          pnlPct: 12.5,
        }}
      />
    )),
    parityCase("PekuloHoldingRow", "loss", false, () => (
      <PekuloHoldingRow
        holding={{
          ticker: "BTC",
          label: "Bitcoin",
          account: "Crypto.com",
          kind: "crypto",
          quantity: 0.45,
          pricePerUnit: 56000,
          marketValueEur: 25200,
          pnlEur: -3800,
          pnlPct: -13.1,
        }}
      />
    )),
    parityCase("PekuloHypothesisCard", "reaches", true, () => (
      <PekuloHypothesisCard
        reaches
        headline="Tu atteins ton cap en 2055."
        deltaLabel={`+${eur0.format(20000)} vs cap requis`}
      />
    )),
    parityCase("PekuloHypothesisVerdict", "reaches", true, () => (
      <PekuloHypothesisVerdict
        reaches
        headline="Tu atteins ton cap en 2055."
        deltaLabel={`+${eur0.format(20000)} vs cap requis`}
      />
    )),
    parityCase("PekuloHypothesisVerdict", "gap", false, () => (
      <PekuloHypothesisVerdict
        reaches={false}
        headline="Tu n'atteins pas ton cap en 2055."
        deltaLabel={`−${eur0.format(150000)} vs cap requis`}
        gapLabel={`Il manque ${eur0.format(120)} / mois pour atteindre le cap.`}
      />
    )),
    parityCase("PekuloKpiTile", "text", true, () => (
      <PekuloKpiTile label="Cap" valueTop="22%" valueBottom="objectif 2055" />
    )),
    parityCase("PekuloKpiTile", "donut", false, () => (
      <PekuloKpiTile label="Cap" valueTop="22%" progress={0.22} />
    )),
    parityCase("PekuloMilestoneRow", "ahead", true, () => (
      <PekuloMilestoneRow
        milestone={{
          label: "1er palier",
          targetEur: 50000,
          targetYear: 2030,
          progressPct: 0.55,
          deltaEur: 1500,
          status: "ahead",
        }}
      />
    )),
    parityCase("PekuloMilestoneRow", "behind", false, () => (
      <PekuloMilestoneRow
        milestone={{
          label: "2e palier",
          targetEur: 100000,
          targetYear: 2035,
          progressPct: 0.2,
          deltaEur: -2300,
          status: "behind",
        }}
      />
    )),
    parityCase("PekuloMilestonesCard", "two", true, () => (
      <PekuloMilestonesCard
        milestones={[
          {
            label: "Apport résidence principale",
            targetEur: 60000,
            targetYear: 2030,
            progressPct: 0.4,
            deltaEur: 1200,
            status: "ahead",
          },
          {
            label: "Liberté financière",
            targetEur: 500000,
            targetYear: 2055,
            progressPct: 0.18,
            deltaEur: -3400,
            status: "behind",
          },
        ]}
      />
    )),
    parityCase("PekuloMobileBottomNav", "cap", true, () => (
      <PekuloMobileBottomNav activeKey="cap" onSelect={noop} />
    )),
    parityCase("PekuloMonthlyRow", "openPositive", true, () => (
      <PekuloMonthlyRow
        month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }}
      />
    )),
    parityCase("PekuloNavRail", "cap", true, () => <PekuloNavRail activeKey="cap" onSelect={noop} />),
    parityCase("PekuloPagination", "mid", true, () => (
      <PekuloPagination page={3} pageCount={7} onPageChange={noop} />
    )),
    parityCase("PekuloProjectionChart", "default", true, () => (
      <PekuloProjectionChart
        years={[2026, 2030, 2040, 2055]}
        actual={[180, 250, 400, 650]}
        required={[180, 260, 420, 800]}
        nowMarker={{ year: 2026, value: 180 }}
        capMarker={{ year: 2055, value: 800 }}
      />
    )),
    parityCase("PekuloPropertyCard", "default", true, () => (
      <PekuloPropertyCard
        property={{
          label: "Appartement Lyon",
          valuationEur: 320000,
          debtRemainingEur: 180000,
          monthlyPaymentEur: 1240,
          yearsRemaining: 18,
          repaidPct: 0.31,
        }}
      />
    )),
    parityCase("PekuloRecentActivityCard", "two", true, () => (
      <PekuloRecentActivityCard
        activities={[
          { label: "Salaire", account: "CB Bourso", category: "Revenus", direction: "in", amountEur: 3200 },
          { label: "Carrefour", account: "CB Bourso", category: "Courses", direction: "out", amountEur: 87 },
        ]}
      />
    )),
    parityCase("PekuloSegmentedControl", "theme", true, () => (
      <PekuloSegmentedControl<"system" | "dark" | "light">
        value="dark"
        onChange={noop}
        ariaLabel="Thème"
        options={[
          { value: "system", label: "Système", icon: Monitor },
          { value: "dark", label: "Sombre", icon: Moon },
          { value: "light", label: "Clair", icon: Sun },
        ]}
      />
    )),
    parityCase("PekuloSettingRow", "default", true, () => (
      <PekuloSettingRow label="Email" value="alex@example.fr" />
    )),
    parityCase("PekuloSettingRow", "destructive", false, () => (
      <PekuloSettingRow label="Supprimer le compte" sub="Action irréversible" destructive />
    )),
    parityCase("PekuloSkeleton", "lines", true, () => <PekuloSkeleton lines={3} />),
    parityCase("PekuloStaggerList", "three", true, () => (
      <PekuloStaggerList ariaLabel="paliers">
        <Text>Apport</Text>
        <Text>Indep</Text>
        <Text>Liberté</Text>
      </PekuloStaggerList>
    )),
    parityCase("PekuloStat", "neutral", false, () => <PekuloStat label="Net" value="+1 050 €" />),
    parityCase("PekuloStat", "gain", true, () => <PekuloStat label="Net" value="+1 050 €" tone="gain" />),
    parityCase("PekuloSuggestionRow", "pending", true, () => (
      <PekuloSuggestionRow
        tx={{
          label: "Carrefour",
          account: "CB Bourso",
          dateLabel: "12 mai",
          direction: "out",
          amountEur: 87,
          suggestedCategory: "Courses",
          confidence: 0.91,
          route: "ios",
        }}
        onConfirm={noop}
        onEdit={noop}
      />
    )),
    parityCase("PekuloSuggestionRow", "lowConfidence", false, () => (
      <PekuloSuggestionRow
        tx={{
          label: "AMZN MKTPL",
          account: "CB",
          dateLabel: "10 mai",
          direction: "out",
          amountEur: 42,
          suggestedCategory: "Maison",
          confidence: 0.62,
          route: "ollama",
        }}
        onConfirm={noop}
        onEdit={noop}
      />
    )),
    parityCase("PekuloToggleRow", "unchecked", true, () => (
      <PekuloToggleRow label="LLM tiers" sub="Activer le routage cloud" checked={false} onChange={noop} />
    )),
    parityCase("PekuloToggleRow", "checked", false, () => (
      <PekuloToggleRow label="LLM tiers" checked onChange={noop} />
    )),
    parityCase("PekuloTopTabToggle", "cap", true, () => <PekuloTopTabToggle topTab="cap" onChange={noop} />),
    parityCase("PekuloTrajectoryCard", "default", true, () => (
      <PekuloTrajectoryCard
        months={[0, 3, 6, 9, 12]}
        actual={[100, 105, 112, 118, 124]}
        plan={[100, 104, 108, 112, 116]}
      />
    )),
    parityCase("PekuloTrajectoryChart", "default", true, () => (
      <PekuloTrajectoryChart
        months={[1, 2, 3, 4, 5, 6]}
        actual={[100, 110, 115, 123, 130, 140]}
        plan={[100, 108, 116, 124, 132, 140]}
      />
    )),
    parityCase("PekuloUserDot", "initial", true, () => <PekuloUserDot initial="a" />),
    parityCase("TransactionLogo", "categoryFallback", true, () => <TransactionLogo category="courses" />),
  ];
  ```

  Create `packages/ui/src/parity/index.ts`:

  ```ts
  // packages/ui/src/parity/index.ts
  // `@pekulo/ui/parity` — story 10-5 parity catalog + comparison model.
  // Consumers: packages/ui parity tests, apps/mobile parity test, the mobile DS
  // gallery route, and the Maestro ds-gallery flow generator test.
  export * from "./types";
  export * from "./text-styles";
  export { PARITY_CASES, PARITY_EXEMPT_COMPONENTS } from "./cases";
  ```

  In `packages/ui/package.json`, add the `./parity` entry to `exports`. Replace:

  ```json
      "./client": "./src/client.ts",
  ```

  with:

  ```json
      "./client": "./src/client.ts",
      "./parity": "./src/parity/index.ts",
  ```

  In `apps/mobile/jest.config.js`, inside `moduleNameMapper`, replace:

  ```js
      "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
  ```

  with:

  ```js
      "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
      "^@pekulo/ui/parity$": "<rootDir>/../../packages/ui/src/parity/index.ts",
  ```

  If either typecheck reports a prop type error in `cases.tsx`, fix the **case props** to the component's declared props (read the component file under `packages/ui/src/components/<Name>/`), never the component.

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/mobile' run typecheck`
  Expected: both exit 0 (no `error TS` lines).
  Commit: `git add packages/ui/src/parity/icons.ts packages/ui/src/parity/icons.native.ts packages/ui/src/parity/cases.tsx packages/ui/src/parity/index.ts packages/ui/package.json apps/mobile/jest.config.js && git commit -m "feat(#156): add shared @pekulo/ui/parity catalog for all 42 components"`

- [x] **T3 — Catalog coverage meta-test** [AC: AC-1]

  Create `packages/ui/src/parity/parity-coverage.meta.test.ts`:

  ```ts
  // packages/ui/src/parity/parity-coverage.meta.test.ts
  // Story 10-5 class-killer meta-test (lesson 2026-06-05): enumerate the real
  // components folder and fail naming any component the parity catalog misses,
  // so a new component cannot ship without web ↔ native parity coverage.
  import { describe, it, expect } from "vitest";
  import { readdirSync, statSync } from "node:fs";
  import { dirname, join } from "node:path";
  import { fileURLToPath } from "node:url";

  import { PARITY_CASES, PARITY_EXEMPT_COMPONENTS } from "./cases";

  const COMPONENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "components");

  const componentNames = readdirSync(COMPONENTS_DIR)
    .filter((entry) => statSync(join(COMPONENTS_DIR, entry)).isDirectory())
    .sort();

  describe("parity catalog coverage (story 10-5)", () => {
    it("covers every src/components/<Name> folder with a case or a documented exemption", () => {
      const covered = new Set(PARITY_CASES.map((c) => c.component));
      const missing = componentNames.filter(
        (name) => !covered.has(name) && !(name in PARITY_EXEMPT_COMPONENTS),
      );
      expect(missing).toEqual([]);
    });

    it("only references real component folders", () => {
      const referenced = [...new Set(PARITY_CASES.map((c) => c.component))];
      expect(referenced.filter((name) => !componentNames.includes(name))).toEqual([]);
    });

    it("uses unique deep-link-safe ids of the form <Component>.<variant>", () => {
      const ids = PARITY_CASES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const parityCase of PARITY_CASES) {
        expect(parityCase.id).toMatch(new RegExp(`^${parityCase.component}\\.[A-Za-z0-9]+$`));
      }
    });

    it("marks exactly one golden case per covered component", () => {
      const goldens = new Map<string, number>();
      for (const parityCase of PARITY_CASES) {
        if (parityCase.golden) {
          goldens.set(parityCase.component, (goldens.get(parityCase.component) ?? 0) + 1);
        }
      }
      const covered = [...new Set(PARITY_CASES.map((c) => c.component))];
      expect(covered.filter((name) => goldens.get(name) !== 1)).toEqual([]);
    });

    it("gives every exemption a non-empty reason", () => {
      for (const [name, reason] of Object.entries(PARITY_EXEMPT_COMPONENTS)) {
        expect(`${name}: ${reason.trim()}`).not.toBe(`${name}: `);
      }
    });
  });
  ```

  Run: `cd packages/ui && bunx vitest run src/parity/parity-coverage.meta.test.ts`
  Expected: `Tests  5 passed (5)`, exit 0. Then prove the gate bites (lesson 2026-06-15 — a gate must be shown to fail): temporarily comment out the `parityCase("PekuloUserDot", ...)` line in `cases.tsx`, rerun, confirm the first test fails listing `"PekuloUserDot"`, restore the line, rerun → 5 passed.
  Commit: `git add packages/ui/src/parity/parity-coverage.meta.test.ts && git commit -m "test(#156): gate parity catalog coverage on the components folder"`

- [x] **T4 — Web text-style baseline** [AC: AC-2]

  Why not `renderWithTamagui` from `test/setup.tsx`: it mounts `TamaguiProvider` with `disableInjectCSS` + `disableRootThemeClass`, so no atomic CSS rule exists to resolve. This test mounts its own provider with injection on (verified at write time: `:root ._col-success => color: var(--success)`, `:root .font_body => --f-size-xs: 12px; …`, theme class `t_pekulo-light` on an ancestor, `config.themes["pekulo-light"].success.val === "#007a3d"`).

  Create `packages/ui/src/parity/web-text-styles.test.tsx`:

  ```tsx
  // packages/ui/src/parity/web-text-styles.test.tsx
  // Story 10-5 AC-2 — freezes the resolved web text styles of every parity case
  // in both themes into __baseline__/web-text-styles.json. The native parity
  // test (apps/mobile/__tests__/ds-token-parity.test.tsx) compares against it.
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
  import { PARITY_THEMES, type ParityBaseline, type ParityTheme, type TextStyleRecord } from "./types";

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
        if (match) map.set(match[1], declarations(rule));
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
    if (!match || depth > 5) return raw.trim();
    const next = vars.get(match[1]) ?? match[2];
    return next === undefined ? raw.trim() : resolveValue(next, vars, depth + 1);
  }

  function classSuffix(el: Element, prefix: string, accept: (name: string) => boolean): string | null {
    let current: Element | null = el;
    while (current) {
      for (const cls of Array.from(current.classList)) {
        if (cls.startsWith(prefix) && accept(cls.slice(prefix.length))) return cls.slice(prefix.length);
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

  function ownDeclarations(el: Element, atomic: Map<string, Declarations>): Partial<Record<CssProp, string>> {
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
      expect(baseline["PekuloStat.gain"]["pekulo-dark"]).toEqual([
        { text: "Net", color: normalizeColor(String(tamaguiConfig.themes["pekulo-dark"].colorTertiary?.val)), fontSize: 12, fontWeight: null, letterSpacing: 0.5 },
        { text: "+1 050 €", color: normalizeColor(String(tamaguiConfig.themes["pekulo-dark"].success?.val)), fontSize: 20, fontWeight: "600", letterSpacing: null },
      ]);
      await expect(`${JSON.stringify(baseline, null, 2)}\n`).toMatchFileSnapshot(
        "./__baseline__/web-text-styles.json",
      );
    });
  });
  ```

  Generate the baseline (first run writes the file):

  Run: `cd packages/ui && bunx vitest run src/parity/web-text-styles.test.tsx -u`
  Expected: `Tests  1 passed (1)`, exit 0, and `packages/ui/src/parity/__baseline__/web-text-styles.json` now exists.

  If the `PekuloStat.gain` guard fails, the extractor is broken — do NOT edit the guard's expected values (they are the write-time spike: `Net` → `colorTertiary`, 12, letter-spacing 0.5; `+1 050 €` → `success`, 20, weight 600). Debug by logging `atomicRules(styleRules())` for `_col-success`.

  Then prove it is a real gate:
  Run: `cd packages/ui && bunx vitest run src/parity/web-text-styles.test.tsx`
  Expected: `Tests  1 passed (1)`, exit 0 (no `-u`, compares against the committed file).

  Then confirm the 10-1 web suite is untouched:
  Run: `bun --filter='@pekulo/ui' run test`
  Expected: exit 0; the summary shows the pre-existing `159` files plus the 3 new parity files (`162 passed`), and `git diff --stat packages/ui/src/components packages/ui/src/primitives` prints nothing.
  Commit: `git add packages/ui/src/parity/web-text-styles.test.tsx packages/ui/src/parity/__baseline__/web-text-styles.json && git commit -m "test(#156): freeze resolved web text styles as the parity baseline"`

- [x] **T5 — Native token-parity gate + allow-list** [AC: AC-3]

  Create `apps/mobile/__tests__/helpers/parity-allowlist.ts`:

  ```ts
  // apps/mobile/__tests__/helpers/parity-allowlist.ts
  // Story 10-5 AC-3 — accepted web ↔ native text-style divergences.
  // Key format (exactly what divergenceKey() prints in a failure):
  //   `<caseId>|<theme>|<text>#<occurrence>|<prop>`
  // Every entry is a reviewed decision with a reason that must survive
  // aped-review. A divergence caused by a native bug is FIXED in the
  // `.native.tsx` sibling, never listed here. Stale entries fail the suite.
  import type { ParityTheme, TextStyleDiff } from "@pekulo/ui/parity";

  export const PARITY_ALLOWED_DIVERGENCE: Record<string, string> = {};

  export function divergenceKey(
    caseId: string,
    theme: ParityTheme,
    diff: Pick<TextStyleDiff, "text" | "occurrence" | "prop">,
  ): string {
    return `${caseId}|${theme}|${diff.text}#${diff.occurrence}|${diff.prop}`;
  }
  ```

  Create `apps/mobile/__tests__/ds-token-parity.test.tsx`:

  ```tsx
  // apps/mobile/__tests__/ds-token-parity.test.tsx
  // Story 10-5 AC-3 — every parity case rendered natively must reproduce the
  // web text styles frozen in packages/ui/src/parity/__baseline__/web-text-styles.json
  // (colour, size, weight, letter-spacing), in both themes.
  //
  // Native inheritance mirrors React Native: a <Text> inherits from ancestor
  // <Text> only; a <View> resets inheritance.
  import { readFileSync } from "node:fs";
  import path from "node:path";

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
    type TextStyleRecord,
  } from "@pekulo/ui/parity";
  import { render } from "@testing-library/react-native";
  import { StyleSheet } from "react-native";

  import { PARITY_ALLOWED_DIVERGENCE, divergenceKey } from "./helpers/parity-allowlist";

  type HostNode = {
    type: string;
    props: Record<string, unknown>;
    children: Array<HostNode | string> | null;
  };

  const BASELINE_PATH = path.resolve(
    __dirname,
    "../../../packages/ui/src/parity/__baseline__/web-text-styles.json",
  );
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as ParityBaseline;
  const seenAllowedKeys = new Set<string>();

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
      ? ((StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>)
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
    jest.restoreAllMocks();
  });

  describe("@pekulo/ui web ↔ native text-style parity (story 10-5, AC-3)", () => {
    it("has a web baseline entry for every parity case", () => {
      expect(PARITY_CASES.map((c) => c.id).filter((id) => !(id in baseline))).toEqual([]);
    });

    it.each(PARITY_CASES.map((c) => [c.id, c] as [string, ParityCase]))(
      "%s renders the web text styles natively in both themes",
      async (_id, parityCase) => {
        const unexpected: string[] = [];
        for (const theme of PARITY_THEMES) {
          const view = await render(
            <PekuloRootProvider theme={theme}>{parityCase.render()}</PekuloRootProvider>,
          );
          const records: TextStyleRecord[] = [];
          collectTextRecords(view.toJSON() as HostNode | HostNode[] | null, {}, records);
          await view.unmount();
          for (const diff of diffTextStyles(baseline[parityCase.id]?.[theme] ?? [], records)) {
            const key = divergenceKey(parityCase.id, theme, diff);
            if (key in PARITY_ALLOWED_DIVERGENCE) {
              seenAllowedKeys.add(key);
            } else {
              unexpected.push(`${key} — web=${JSON.stringify(diff.web)} native=${JSON.stringify(diff.native)}`);
            }
          }
        }
        expect(unexpected).toEqual([]);
      },
    );

    // Runs after the it.each above (Jest runs a file's tests in order).
    it("keeps no stale allow-list entries", () => {
      expect(Object.keys(PARITY_ALLOWED_DIVERGENCE).filter((key) => !seenAllowedKeys.has(key))).toEqual([]);
    });
  });
  ```

  Run: `cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx`
  Expected at this point: the suite runs (no import / transform error). It is **expected to fail** on real divergences — that output is the input of T6. Save it: `cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx 2>&1 | tee /tmp/parity-first-run.txt | tail -40`. If it fails on an import / resolution error instead of assertion diffs, fix the wiring (T2 `moduleNameMapper` entry, file paths) before T6.
  Commit (the gate itself, before triage, so the review sees the raw state in history): `git add apps/mobile/__tests__/ds-token-parity.test.tsx apps/mobile/__tests__/helpers/parity-allowlist.ts && git commit -m "test(#156): add native token-parity gate against the web baseline"`

- [x] **T6 — Triage every divergence until the gate is green** [AC: AC-3]

  This task is the only one whose code cannot be written in advance: the divergence list only exists once T5 runs. Follow this decision rule literally, one divergence at a time, from the T5 output (`/tmp/parity-first-run.txt`):

  1. **Native value differs and `packages/ui/src/components/<Name>/<Name>.native.tsx` exists** → the web (10-1 frozen) is the reference. Open the `.native.tsx` sibling, find the `Text` that renders that text, and change its token props (`color`, `fontSize`, `fontWeight`, `letterSpacing` — e.g. `color="$colorTertiary"`, `fontSize="$xs"`) to the exact tokens the web component `packages/ui/src/components/<Name>/<Name>.tsx` uses for the same text. Rerun the single case: `cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx -t "<caseId>"`.
  2. **Native value differs and there is NO `.native.tsx` sibling** (shared source) → the difference comes from the platform (e.g. Tamagui resolving a token differently on native). Do NOT fork the component. Add an allow-list entry whose reason names the mechanism, e.g. `"PekuloStat.neutral|pekulo-dark|Net#0|letterSpacing": "Shared source (no .native.tsx); Tamagui native drops the 0.5px letter-spacing the web class _ls-0--5px applies — platform resolution, not a component divergence."` (write the mechanism you actually observed, not this example's).
  3. **`missing-on-native` / `extra-on-native`** → compare the two sources' rendered strings. If native drops or adds a visible text (e.g. a label the web shows), fix the `.native.tsx` sibling to render the same string. If the extra node is native-only accessibility text with no visual output, allow-list it with that reason.
  4. **Never** edit a web component, a 10-1 `*.snapshot.test.tsx`, or `web-text-styles.json` to make native pass. If the web value itself looks wrong, STOP and ask the user: changing it changes the 10-1 baseline.
  5. After every native source change: `bun --filter='@pekulo/ui' run test` must stay green with zero snapshot updates, because `.native.tsx` files are not rendered by vitest. If it is not, revert that change.

  Run (final): `cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx`
  Expected: `Tests:` line shows `0 failed` (`N passed`, N = number of cases + 2), exit 0.
  Then: `bun --filter='@pekulo/mobile' run test` → exit 0 (all pre-existing suites still green, e.g. `ui-native-parity.test.tsx`).
  Record in the Dev Agent Record the count of fixes (rule 1/3) versus allow-list entries (rule 2/3).
  Commit: `git add apps/mobile/__tests__/helpers/parity-allowlist.ts packages/ui/src/components && git commit -m "fix(#156): align native text tokens with the web baseline"` (stage only the `.native.tsx` files you actually changed if `git status` shows anything else under `packages/ui/src/components`).

- [x] **T7 — In-app DS gallery route** [AC: AC-4]

  Create `apps/mobile/lib/ds-gallery.ts`:

  ```ts
  // apps/mobile/lib/ds-gallery.ts
  // Story 10-5 AC-4 — DS gallery switches. The gallery renders @pekulo/ui parity
  // cases for the Maestro ds-gallery flow; it is only reachable in builds made
  // with EXPO_PUBLIC_DS_GALLERY=1 (the `e2e-test` EAS profile).
  // Direct `process.env.EXPO_PUBLIC_*` member read so babel-preset-expo inlines
  // it in native bundles; `env` injection is for unit tests (same pattern as
  // lib/supabase/client.ts).
  import type { ParityTheme } from "@pekulo/ui/parity";

  export function isDsGalleryEnabled(env?: Record<string, string | undefined>): boolean {
    const raw = env ? env.EXPO_PUBLIC_DS_GALLERY : process.env.EXPO_PUBLIC_DS_GALLERY;
    return raw?.trim() === "1";
  }

  export function resolveGalleryTheme(raw: string | string[] | undefined): ParityTheme {
    return raw === "pekulo-light" ? "pekulo-light" : "pekulo-dark";
  }
  ```

  Create `apps/mobile/app/ds/[case].tsx`:

  ```tsx
  // apps/mobile/app/ds/[case].tsx
  // Story 10-5 AC-4 — renders one @pekulo/ui parity case for screenshot goldens.
  // Deep link: pekulo://ds/<caseId>?theme=pekulo-dark|pekulo-light
  // Redirects to "/" when the gallery is disabled or the case id is unknown.
  // The `ds-case-<id>` container is the Maestro cropOn target, so the status
  // bar clock never enters a golden.
  import { PARITY_CASES } from "@pekulo/ui/parity";
  import { Redirect, useLocalSearchParams } from "expo-router";
  import { ScrollView } from "react-native";
  import { Theme, View } from "tamagui";

  import { isDsGalleryEnabled, resolveGalleryTheme } from "../../lib/ds-gallery";

  export default function DsGalleryCaseScreen() {
    const params = useLocalSearchParams<{ case?: string; theme?: string }>();
    if (!isDsGalleryEnabled()) return <Redirect href="/" />;
    const parityCase = PARITY_CASES.find((c) => c.id === params.case);
    if (!parityCase) return <Redirect href="/" />;
    const theme = resolveGalleryTheme(params.theme);

    return (
      <Theme name={theme}>
        <View flex={1} backgroundColor="$background">
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ padding: 16 }}
          >
            <View
              testID={`ds-case-${parityCase.id}`}
              collapsable={false}
              padding="$4"
              backgroundColor="$background"
            >
              {parityCase.render()}
            </View>
          </ScrollView>
        </View>
      </Theme>
    );
  }
  ```

  Create `apps/mobile/__tests__/ds-gallery-screen.test.tsx`:

  ```tsx
  // apps/mobile/__tests__/ds-gallery-screen.test.tsx
  // Story 10-5 AC-4 — DS gallery route behaviour.
  import { PekuloRootProvider } from "@pekulo/ui";
  import { render, screen } from "@testing-library/react-native";

  import DsGalleryCaseScreen from "../app/ds/[case]";
  import { isDsGalleryEnabled } from "../lib/ds-gallery";

  const mockParams: { case?: string; theme?: string } = {};

  jest.mock("expo-router", () => {
    const { createElement } = require("react") as typeof import("react");
    const { Text } = require("react-native") as typeof import("react-native");
    return {
      useLocalSearchParams: () => mockParams,
      Redirect: ({ href }: { href: string }) => createElement(Text, null, `redirect:${href}`),
    };
  });

  jest.mock("../lib/ds-gallery", () => ({
    ...jest.requireActual("../lib/ds-gallery"),
    isDsGalleryEnabled: jest.fn(() => true),
  }));

  const actualGallery = jest.requireActual<typeof import("../lib/ds-gallery")>("../lib/ds-gallery");

  async function renderScreen(): Promise<void> {
    await render(
      <PekuloRootProvider theme="pekulo-dark">
        <DsGalleryCaseScreen />
      </PekuloRootProvider>,
    );
  }

  beforeEach(() => {
    mockParams.case = undefined;
    mockParams.theme = undefined;
    (isDsGalleryEnabled as jest.Mock).mockReturnValue(true);
  });

  describe("DS gallery route (story 10-5, AC-4)", () => {
    it("renders the requested parity case inside its cropOn container", async () => {
      mockParams.case = "PekuloStat.gain";
      mockParams.theme = "pekulo-light";
      await renderScreen();
      expect(screen.getByTestId("ds-case-PekuloStat.gain")).toBeTruthy();
      expect(screen.getByText("Net")).toBeTruthy();
      expect(screen.getByText("+1 050 €")).toBeTruthy();
    });

    it("redirects home for an unknown case id", async () => {
      mockParams.case = "PekuloStat.nope";
      await renderScreen();
      expect(screen.getByText("redirect:/")).toBeTruthy();
    });

    it("redirects home when the gallery is disabled", async () => {
      (isDsGalleryEnabled as jest.Mock).mockReturnValue(false);
      mockParams.case = "PekuloStat.gain";
      await renderScreen();
      expect(screen.getByText("redirect:/")).toBeTruthy();
      expect(screen.queryByTestId("ds-case-PekuloStat.gain")).toBeNull();
    });

    it("enables the gallery only for EXPO_PUBLIC_DS_GALLERY=1 and defaults to the dark theme", () => {
      expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "1" })).toBe(true);
      expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: " 1 " })).toBe(true);
      expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "true" })).toBe(false);
      expect(actualGallery.isDsGalleryEnabled({})).toBe(false);
      expect(actualGallery.resolveGalleryTheme("pekulo-light")).toBe("pekulo-light");
      expect(actualGallery.resolveGalleryTheme("pekulo-dark")).toBe("pekulo-dark");
      expect(actualGallery.resolveGalleryTheme(undefined)).toBe("pekulo-dark");
      expect(actualGallery.resolveGalleryTheme(["pekulo-light"])).toBe("pekulo-dark");
    });
  });
  ```

  Run: `cd apps/mobile && bunx jest __tests__/ds-gallery-screen.test.tsx && cd ../.. && bun --filter='@pekulo/mobile' run typecheck`
  Expected: `Tests:       4 passed, 4 total`, then typecheck exit 0 (typed routes regenerate `.expo/types` on the next `expo start`; if `tsc` rejects `href="/"`, it will not — `/` already exists).
  Commit: `git add apps/mobile/lib/ds-gallery.ts "apps/mobile/app/ds/[case].tsx" apps/mobile/__tests__/ds-gallery-screen.test.tsx && git commit -m "feat(#156): add flag-gated DS gallery route for screenshot goldens"`

- [x] **T8 — Move Maestro under `apps/mobile/.maestro/` and write the hand-written flows** [AC: AC-5]

  Delete the stale root flow (its `assertVisible: "Design System"` step targets a string that no longer exists in `apps/mobile`):

  Run: `git rm .maestro/smoke.yaml`

  Create `apps/mobile/.maestro/config.yaml`:

  ```yaml
  # apps/mobile/.maestro/config.yaml — story 10-5
  # Workspace config: `maestro test apps/mobile/.maestro` runs every flow below.
  flows:
    - "flows/*"
  ```

  Create `apps/mobile/.maestro/flows/smoke.yaml`:

  ```yaml
  # Story 10-5 AC-5 — the five tabs render their preview figures (no backend).
  appId: app.pekulo.mobile
  name: Smoke — five tabs render preview data
  tags:
    - smoke
  ---
  - launchApp:
      clearState: true
      clearKeychain: true
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 30000
  - tapOn: "Transactions"
  - extendedWaitUntil:
      visible: "Solde du mois"
      timeout: 10000
  - tapOn: "Mensuel"
  - extendedWaitUntil:
      visible: "Épargne nette"
      timeout: 10000
  - tapOn: "Portefeuille"
  - extendedWaitUntil:
      visible: "Plus-value latente"
      timeout: 10000
  - tapOn: "Immobilier"
  - extendedWaitUntil:
      visible: "Équité nette"
      timeout: 10000
  - tapOn: "Cap"
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 10000
  ```

  Create `apps/mobile/.maestro/flows/navigation.yaml`:

  ```yaml
  # Story 10-5 AC-5 — Paramètres opens from the Cap header and closes.
  # Targets the in-content settings button by testID (never a top-right
  # coordinate tap: the Expo dev-tools button sits there in Dev Client builds).
  appId: app.pekulo.mobile
  name: Navigation — Paramètres sheet opens from Cap and closes
  tags:
    - navigation
  ---
  - launchApp:
      clearState: true
      clearKeychain: true
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 30000
  - tapOn:
      id: "open-settings-btn"
  - extendedWaitUntil:
      visible: "Apparence"
      timeout: 10000
  - assertVisible: "Compte"
  - assertVisible: "Mode aperçu"
  - swipe:
      start: "50%, 12%"
      end: "50%, 92%"
  - extendedWaitUntil:
      notVisible: "Apparence"
      timeout: 10000
  - assertVisible: "Patrimoine total"
  ```

  Create `apps/mobile/.maestro/flows/preview-guard.yaml`:

  ```yaml
  # Story 10-5 AC-5 — in preview mode a mutation is blocked with the sign-in
  # prompt (10-4 AC-6), and dismissing it leaves the user on Paramètres.
  appId: app.pekulo.mobile
  name: Preview guard — mutation shows the sign-in prompt
  tags:
    - preview-guard
  ---
  - launchApp:
      clearState: true
      clearKeychain: true
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 30000
  - tapOn:
      id: "open-settings-btn"
  - scrollUntilVisible:
      element:
        id: "llm-optin-switch"
      direction: DOWN
      timeout: 10000
  - tapOn:
      id: "llm-optin-switch"
  - extendedWaitUntil:
      visible: "Connectez-vous pour enregistrer des modifications sur votre compte."
      timeout: 10000
  - assertVisible: "Se connecter"
  - tapOn: "Plus tard"
  - extendedWaitUntil:
      notVisible: "Connectez-vous pour enregistrer des modifications sur votre compte."
      timeout: 10000
  - assertVisible: "Apparence"
  ```

  These flows are exercised for real in T15 (no Maestro or Simulator build is available to the dev agent). Static check now:

  Run: `test ! -e .maestro/smoke.yaml && ls apps/mobile/.maestro/config.yaml apps/mobile/.maestro/flows/smoke.yaml apps/mobile/.maestro/flows/navigation.yaml apps/mobile/.maestro/flows/preview-guard.yaml`
  Expected: the four paths are printed, exit 0.
  Commit: `git add apps/mobile/.maestro/config.yaml apps/mobile/.maestro/flows/smoke.yaml apps/mobile/.maestro/flows/navigation.yaml apps/mobile/.maestro/flows/preview-guard.yaml && git commit -m "test(#156): move Maestro under apps/mobile and rewrite smoke, navigation, preview-guard flows"` (the `git rm` above is already staged and lands in this commit).

- [x] **T9 — Generated `ds-gallery` flow + freshness test** [AC: AC-5]

  Create `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts`:

  ```ts
  // apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts
  // Story 10-5 AC-5 — apps/mobile/.maestro/flows/ds-gallery.yaml is GENERATED
  // from PARITY_CASES (one step block per golden case). This test fails when
  // the committed flow drifts from the catalog. Regenerate with:
  //   cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest __tests__/maestro-ds-gallery-flow.test.ts
  //
  // Golden mode: MAESTRO_UPDATE_GOLDENS=true → takeScreenshot (artifacts),
  // otherwise assertScreenshot against apps/mobile/.maestro/goldens/ios/.
  import { readFileSync, writeFileSync } from "node:fs";
  import path from "node:path";

  import { PARITY_CASES } from "@pekulo/ui/parity";

  const FLOW_PATH = path.resolve(__dirname, "../.maestro/flows/ds-gallery.yaml");
  // takeScreenshot `path` is relative to Maestro's artifact output; assertScreenshot
  // `path` is resolved from the flow file. Both prefixes are verified in T15.
  const GOLDEN_CAPTURE_PREFIX = "goldens/ios/";
  const GOLDEN_ASSERT_PREFIX = "../goldens/ios/";
  const UPDATE_GOLDENS =
    "${typeof MAESTRO_UPDATE_GOLDENS !== 'undefined' && MAESTRO_UPDATE_GOLDENS === 'true'}";
  const ASSERT_GOLDENS =
    "${typeof MAESTRO_UPDATE_GOLDENS === 'undefined' || MAESTRO_UPDATE_GOLDENS !== 'true'}";

  function caseSteps(id: string): string[] {
    return [
      `- openLink: "pekulo://ds/${id}?theme=pekulo-dark"`,
      "- runFlow:",
      "    when:",
      '      visible: "Open"',
      "    commands:",
      '      - tapOn: "Open"',
      "- extendedWaitUntil:",
      "    visible:",
      `      id: "ds-case-${id}"`,
      "    timeout: 15000",
      "- waitForAnimationToEnd:",
      "    timeout: 5000",
      "- runFlow:",
      "    when:",
      `      true: ${UPDATE_GOLDENS}`,
      "    commands:",
      "      - takeScreenshot:",
      `          path: "${GOLDEN_CAPTURE_PREFIX}${id}"`,
      "          cropOn:",
      `            id: "ds-case-${id}"`,
      "- runFlow:",
      "    when:",
      `      true: ${ASSERT_GOLDENS}`,
      "    commands:",
      "      - assertScreenshot:",
      `          path: "${GOLDEN_ASSERT_PREFIX}${id}.png"`,
      "          cropOn:",
      `            id: "ds-case-${id}"`,
      "          thresholdPercentage: 98",
    ];
  }

  export function buildDsGalleryFlow(): string {
    const goldenIds = PARITY_CASES.filter((c) => c.golden).map((c) => c.id);
    const lines = [
      "# GENERATED by apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts — do not edit.",
      "# Story 10-5 AC-5 — one iOS screenshot golden per @pekulo/ui component.",
      "appId: app.pekulo.mobile",
      "name: DS gallery — iOS goldens",
      "tags:",
      "  - ds-gallery",
      "---",
      "- launchApp:",
      "    clearState: true",
      ...goldenIds.flatMap(caseSteps),
    ];
    return `${lines.join("\n")}\n`;
  }

  describe("Maestro ds-gallery flow (story 10-5, AC-5)", () => {
    it("is generated from PARITY_CASES and committed up to date", () => {
      const expected = buildDsGalleryFlow();
      if (process.env.UPDATE_DS_FLOW === "1") writeFileSync(FLOW_PATH, expected);
      expect(readFileSync(FLOW_PATH, "utf8")).toBe(expected);
    });

    it("captures exactly one golden per component", () => {
      const goldenCount = PARITY_CASES.filter((c) => c.golden).length;
      const components = new Set(PARITY_CASES.map((c) => c.component)).size;
      expect(goldenCount).toBe(components);
      expect(buildDsGalleryFlow().match(/- assertScreenshot:/g)?.length).toBe(goldenCount);
    });
  });
  ```

  Run (generate): `cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest __tests__/maestro-ds-gallery-flow.test.ts`
  Expected: `Tests:       2 passed, 2 total`; `apps/mobile/.maestro/flows/ds-gallery.yaml` exists and contains 42 `- assertScreenshot:` lines (`grep -c -- '- assertScreenshot:' apps/mobile/.maestro/flows/ds-gallery.yaml` → `42`).
  Run (gate): `cd apps/mobile && bunx jest __tests__/maestro-ds-gallery-flow.test.ts`
  Expected: `Tests:       2 passed, 2 total`, exit 0.
  Commit: `git add apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts apps/mobile/.maestro/flows/ds-gallery.yaml && git commit -m "test(#156): generate the ds-gallery Maestro flow from the parity catalog"`

- [x] **T10 — Keep generated artefacts out of the formatter** [AC: AC-7]

  `oxfmt` must not rewrite the generated flow (the freshness test compares bytes) or the vitest file snapshot. In `.oxfmtrc.json`, replace:

  ```json
      "apps/mobile/expo-env.d.ts",
  ```

  with:

  ```json
      "apps/mobile/expo-env.d.ts",
      "apps/mobile/.maestro/",
      "packages/ui/src/parity/__baseline__/",
  ```

  Run: `bun run format:check`
  Expected: the only files reported (if any) are the untracked third-party `.claude/skills/{ui-taste,ios-design}` files already flagged at 10-4; nothing under `apps/`, `packages/`, or `docs/`. If a file you created in T1–T9 is reported, run `bunx oxfmt <that file>` and amend it into this commit.
  Commit: `git add .oxfmtrc.json && git commit -m "chore(#156): exclude generated Maestro flow and parity baseline from oxfmt"`

- [x] **T11 — EAS `e2e-test` profile + workflows** [AC: AC-6]

  Replace `apps/mobile/eas.json` with:

  ```json
  {
    "cli": {
      "version": ">= 16.0.1",
      "appVersionSource": "remote"
    },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal",
        "autoIncrement": true
      },
      "preview": {
        "distribution": "internal",
        "autoIncrement": true
      },
      "production": {
        "autoIncrement": true
      },
      "e2e-test": {
        "withoutCredentials": true,
        "bun": "1.3.14",
        "ios": {
          "simulator": true
        },
        "env": {
          "EXPO_PUBLIC_DS_GALLERY": "1",
          "EXPO_PUBLIC_SUPABASE_URL": "",
          "EXPO_PUBLIC_SUPABASE_ANON_KEY": "",
          "EXPO_PUBLIC_API_BASE_URL": "",
          "DATABASE_URL": "postgresql://stub:stub@localhost:5432/stub"
        }
      }
    },
    "submit": {
      "production": {},
      "development": {}
    }
  }
  ```

  Why each `e2e-test` key: `ios.simulator` + `withoutCredentials` are the shape of Expo's E2E example (a simulator build needs no signing); `bun: "1.3.14"` keeps EAS on the repo's pinned Bun (PR #159 — 1.3.13 crashed builds); blank `EXPO_PUBLIC_SUPABASE_*` keep `isSupabaseConfigured()` false → deterministic preview data, no network; blank `EXPO_PUBLIC_API_BASE_URL` is safe because `getApiBaseUrl()` is only called lazily by a query, and every query is disabled while unauthenticated; `DATABASE_URL` is the Prisma stub that the root `bun install` → `apps/api` `postinstall: prisma generate` requires (lesson 2026-05-05).

  Create `apps/mobile/.eas/workflows/e2e-ios.yml`:

  ```yaml
  # Story 10-5 AC-6 — iOS Simulator build + Maestro E2E on EAS Workflows.
  # Non-required check: Expo labels the maestro job "alpha".
  name: e2e-ios

  on:
    pull_request:
      branches: ["main"]
      paths:
        - "apps/mobile/**"
        - "packages/ui/**"
        - "packages/contracts/**"
        - "packages/validators/**"
        - "packages/types/**"

  jobs:
    build_ios_simulator:
      name: Build iOS Simulator (e2e-test)
      type: build
      params:
        platform: ios
        profile: e2e-test

    maestro_ios:
      name: Maestro E2E (iOS)
      needs: [build_ios_simulator]
      type: maestro
      params:
        build_id: ${{ needs.build_ios_simulator.outputs.build_id }}
        flow_path:
          - ".maestro/flows/smoke.yaml"
          - ".maestro/flows/navigation.yaml"
          - ".maestro/flows/preview-guard.yaml"
          - ".maestro/flows/ds-gallery.yaml"
        retries: 1
        record_screen: true
  ```

  Create `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml`:

  ```yaml
  # Story 10-5 AC-6 — regenerates the iOS DS goldens on the SAME simulator image
  # the e2e workflow asserts against. Manual only:
  #   cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios-update-goldens.yml
  # Download the "Maestro Test Results" artifact and copy the PNGs into
  # apps/mobile/.maestro/goldens/ios/ (see apps/mobile/README.md).
  name: e2e-ios-update-goldens

  on:
    workflow_dispatch: {}

  jobs:
    build_ios_simulator:
      name: Build iOS Simulator (e2e-test)
      type: build
      params:
        platform: ios
        profile: e2e-test

    capture_goldens:
      name: Capture DS goldens (iOS)
      needs: [build_ios_simulator]
      type: maestro
      env:
        MAESTRO_UPDATE_GOLDENS: "true"
      params:
        build_id: ${{ needs.build_ios_simulator.outputs.build_id }}
        flow_path: ".maestro/flows/ds-gallery.yaml"
  ```

  Create `apps/mobile/.maestro/goldens/ios/.gitkeep` (empty file) so the golden directory exists before T15 fills it.

  Run: `node -e "const j=require('./apps/mobile/eas.json'); const p=j.build['e2e-test']; if(!p.ios.simulator||p.env.EXPO_PUBLIC_DS_GALLERY!=='1'||p.env.EXPO_PUBLIC_SUPABASE_URL!==''||p.bun!=='1.3.14') process.exit(1); console.log('e2e-test profile ok')"`
  Expected: `e2e-test profile ok`, exit 0.
  Commit: `git add apps/mobile/eas.json apps/mobile/.eas/workflows/e2e-ios.yml apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml apps/mobile/.maestro/goldens/ios/.gitkeep && git commit -m "ci(#156): add EAS e2e-test profile and iOS Maestro workflows"`

- [x] **T12 — `apps/mobile/README.md`: Maestro + EAS commands** [AC: AC-7]

  In `apps/mobile/README.md`, replace the line `- Bun (\`bun@1.3.13\`)` with `- Bun (\`bun@1.3.14\`)`, then replace the block:

  ~~~markdown
  # Maestro E2E smoke (requires booted iOS Simulator with Dev Build installed)
  maestro test .maestro/smoke.yaml
  ```
  ~~~

  with:

  ~~~markdown
  # Web ↔ native text-style parity gate (story 10-5)
  cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx
  ```

  ## E2E — Maestro on EAS Workflows (story 10-5)

  Flows live in `apps/mobile/.maestro/flows/`: `smoke`, `navigation`, `preview-guard`, and the generated `ds-gallery` (one iOS screenshot golden per `@pekulo/ui` component, rendered by the flag-gated route `app/ds/[case].tsx`). They run against the `e2e-test` profile: an iOS Simulator build in preview mode (no backend), DS gallery on.

  ```bash
  # CI: runs automatically on PRs to main touching apps/mobile or packages/{ui,contracts,validators,types}
  # (apps/mobile/.eas/workflows/e2e-ios.yml — non-required check).

  # Run the E2E workflow manually
  cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml

  # Regenerate the ds-gallery flow after adding/removing a parity case
  cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest __tests__/maestro-ds-gallery-flow.test.ts

  # Refresh the iOS goldens after an INTENTIONAL visual change
  cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios-update-goldens.yml
  # then download the "Maestro Test Results" artifact from the run page and copy
  # its goldens/ios/*.png into apps/mobile/.maestro/goldens/ios/, review, commit.

  # Local run (Maestro CLI + a Release simulator build with EXPO_PUBLIC_DS_GALLERY=1)
  maestro test apps/mobile/.maestro
  ```
  ~~~

  Run: `grep -c 'ds-token-parity' apps/mobile/README.md && ! grep -q 'maestro test .maestro/smoke.yaml' apps/mobile/README.md && echo README-ok`
  Expected: `1` then `README-ok`.
  Commit: `git add apps/mobile/README.md && git commit -m "docs(#156): document the parity gate and Maestro/EAS commands"`

- [x] **T13 — Epic, state, and architecture doc-sync** [AC: AC-7]

  1. In `docs/epics.md`, directly **after** the `**Complexity:** M` line that closes `#### Story 10-5-mobile-parity-and-maestro`, append (supersede, never delete the original summary):

  ```markdown

  > **Realized scope (2026-11-22, step-04, user-approved) — supersedes the title and summary above without deleting them.** The 10-1 web snapshots are DOM/atomic-class inline snapshots, not images, so "pixel-diff against the 10-1 snapshots" is implemented as a hybrid: (1) a deterministic web ↔ native **text-style token-parity gate** — `@pekulo/ui/parity` catalog covering all 42 components, web baseline `packages/ui/src/parity/__baseline__/web-text-styles.json` (vitest), native comparison `apps/mobile/__tests__/ds-token-parity.test.tsx` (Jest); (2) **iOS screenshot goldens** of every component from a flag-gated in-app DS gallery (`pekulo://ds/<case>`), asserted by Maestro. The Maestro suite (`smoke`, `navigation`, `preview-guard`, `ds-gallery`) runs on **EAS Workflows** against an iOS Simulator build in preview mode, on PRs to `main` touching mobile-relevant paths (non-required check; EAS's maestro job is alpha). **iOS only** — Android moves to `10-6`. Primitives parity is a follow-up.

  **Complexity:** L (re-estimated from M)

  #### Story 10-6-android-parity-and-maestro

  **Ticket:** none yet (create when the story is picked up)
  **Title:** Android build, native-surface adaptation, and Maestro E2E on an Android emulator

  **Depends on:** 10-5-mobile-parity-and-maestro

  **As a** Pekulo user on Android, **I want** the mobile app to build, behave, and pass the same Maestro suite on Android, **so that** the V1.5 app ships on both stores with the parity guarantees 10-5 established for iOS.

  **Summary:** Run the first `android/` prebuild, replace the iOS-only surfaces shipped in 10-4 (`ActionSheetIOS`, `Alert.prompt`, iOS `formSheet` detents, SF Symbols) with cross-platform equivalents, add an Android build + `type: maestro` job (Android emulator) to the EAS workflows, and capture Android goldens for the `ds-gallery` flow.

  **Covered FRs:** FR-56 (Android parity)
  **Complexity:** M
  ```

  2. In `docs/state.yaml`, directly after the `10-5-mobile-parity-and-maestro:` line, add:

  ```yaml
      10-6-android-parity-and-maestro: {status: pending, depends_on: [10-5-mobile-parity-and-maestro], ticket: null, worktree: null}
  ```

  3. In `docs/architecture.md`, in the **Test pyramid (D6)** bullet, replace `**Playwright** (E2E web; mobile E2E V1.5 via Maestro on Expo)` with `**Playwright** (E2E web) ; **Jest + jest-expo + RNTL** for \`apps/mobile\`, including the web ↔ native text-style token-parity gate against \`@pekulo/ui/parity\` (story 10-5) ; **Maestro on EAS Workflows** (iOS Simulator, preview mode: smoke / navigation / preview-guard / DS-gallery screenshot goldens — story 10-5; Android in 10-6)`.

  4. In `docs/architecture.md`, in the FR table row `| FR-56 | Visual parity web ↔ mobile via per-component snapshot |`, replace its third cell `` `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx` + Maestro mobile snapshot suite (V1.5) `` with `` `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx` (web) + `@pekulo/ui/parity` token-parity gate (`apps/mobile/__tests__/ds-token-parity.test.tsx`) + Maestro iOS DS goldens (`apps/mobile/.maestro/flows/ds-gallery.yaml`) ``. Keep the table's column padding aligned (`bun run format:check` ignores nothing under `docs/` except stories/state).

  Run: `grep -c '10-6-android-parity-and-maestro' docs/epics.md docs/state.yaml && grep -c 'ds-token-parity' docs/architecture.md && bun run format:check`
  Expected: `docs/epics.md:1`, `docs/state.yaml:1`, then `2`, then format:check reports nothing under `docs/`.
  Commit: `git add docs/epics.md docs/state.yaml docs/architecture.md && git commit -m "docs(#156): record 10-5 realized scope, add story 10-6, update test pyramid"`

- [x] **T14 — Full monorepo sweep** [AC: AC-7]

  Run each, in order, and paste the summary lines into the Dev Agent Record:

  1. `bun run typecheck` → `10 successful, 10 total`, exit 0.
  2. `bun run lint` → `0 errors`; warnings only the 3 pre-existing in `apps/web` (`axe-routes.spec.ts`, `dashboard-edit-context.tsx`, `recent-activity-section.tsx`).
  3. `bun run format:check` → nothing reported outside the untracked `.claude/skills/{ui-taste,ios-design}`.
  4. `bun --filter='@pekulo/ui' run test` → `162 passed` test files (159 pre-existing + `text-styles`, `parity-coverage.meta`, `web-text-styles`), exit 0.
  5. `bun --filter='@pekulo/mobile' run test` → `Test Suites: 16 passed, 16 total` (13 pre-existing + `ds-token-parity`, `ds-gallery-screen`, `maestro-ds-gallery-flow`), exit 0.
  6. `bun --filter='@pekulo/web' run test` → `125 passed`, exit 0.
  7. `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css` → exit 0.
  8. `git diff main --stat -- packages/ui/src/components packages/ui/src/primitives | grep -v '\.native\.tsx' ; git diff main -- '*.snapshot.test.tsx' | head -1` → no web component source and no 10-1 snapshot file changed (only `.native.tsx` files from T6 may appear).

  Commit: none if nothing changed; otherwise `git add <the files you fixed> && git commit -m "chore(#156): fix sweep findings"`.

- [x] **T15 — Live EAS run + golden bootstrap (user-assisted)** [AC: AC-5, AC-6]

  The dev agent cannot do this alone: it needs the user's Expo account. Ask the user before each step marked **(user)**; never run `eas init` without explicit approval (it writes `owner` and `extra.eas.projectId` into `apps/mobile/app.json` and creates the project on expo.dev).

  1. **(user)** `! cd apps/mobile && bunx eas-cli@latest login`
  2. **(user, approve first)** `! cd apps/mobile && bunx eas-cli@latest init` → commit the resulting `apps/mobile/app.json` change: `git add apps/mobile/app.json && git commit -m "chore(#156): link apps/mobile to its EAS project"`.
  3. **(user)** On expo.dev → the project → GitHub: install the Expo GitHub app on `yabafre/pekulo`, link the repository, and set the base directory to `apps/mobile` (required for `on: pull_request` triggers). Confirm the account's plan runs EAS Workflows (Expo does not document free-plan availability).
  4. `cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios-update-goldens.yml` → wait for success, download the **Maestro Test Results** artifact, and copy its `goldens/ios/*.png` into `apps/mobile/.maestro/goldens/ios/`. Expected: 42 PNGs (`ls apps/mobile/.maestro/goldens/ios/*.png | wc -l` → `42`). Open a sample (`PekuloStat.gain.png`, `PekuloDonut.centered.png`, `PekuloErrorBoundary.fallback.png`) and check each shows only the component, dark theme, no status bar.
     - If the build fails on `bun install` / `prisma generate`, add the missing variable to the `e2e-test` `env` block in `eas.json` and rerun.
     - If the screenshots land under a different relative path in the artifact, adjust `GOLDEN_CAPTURE_PREFIX` in `maestro-ds-gallery-flow.test.ts`, regenerate the flow (T9 command), and rerun.
  5. Commit the goldens: `git add apps/mobile/.maestro/goldens/ios/*.png && git commit -m "test(#156): add iOS DS goldens captured on EAS"`.
  6. `cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml` → all four flows green.
     - If `ds-gallery` fails with "comparison image doesn't exist", the assert path resolves from a different base: change `GOLDEN_ASSERT_PREFIX` (try `".maestro/goldens/ios/"` then `"goldens/ios/"`), regenerate (T9), commit, rerun.
     - If a hand-written flow fails on a selector (e.g. `tapOn: "Transactions"` matching a non-tab element), switch that step to the tab's `id` (`tab-transactions`, `tab-monthly` …, from `app/(tabs)/_layout.tsx`) and rerun. Record every such change in the Dev Agent Record.
  7. Push the branch and open the PR (`Closes #156`); confirm the `e2e-ios` workflow is triggered by the PR (proves the GitHub path filter) and is green.

  Expected: both workflows green on EAS, the PR shows the EAS check, 42 goldens committed.

## Dev Notes

### Scope decisions (step-04, user-approved 2026-11-22)

- **Parity basis = hybrid.** The 10-1 web "visual snapshots" are DOM / Tamagui atomic-class inline snapshots (`container.innerHTML` → `toMatchInlineSnapshot`), not images — there is no web PNG to pixel-diff against. Parity is therefore proven in two layers: (1) a deterministic **token-parity gate** — each text node's resolved `color` / `fontSize` / `fontWeight` / `letterSpacing` on web (vitest, resolved from Tamagui's injected atomic CSS + theme/token/font variables) must equal the native rendering (Jest) for the same component and props, in both themes; (2) **iOS screenshot goldens** of every component captured by Maestro from an in-app DS gallery, catching native-only regressions (layout, SVG, spacing) the text gate cannot see. A literal web↔native pixel-diff was rejected (font antialiasing / density noise).
- **CI = EAS Workflows** (`type: build` → `type: maestro`), triggered on pull requests to `main` that touch mobile-relevant paths. No `schedule` trigger: Expo documents scheduled workflows as paid-plan only. The EAS Maestro job is labelled **alpha** by Expo → it ships as a **non-required** check.
- **Platform = iOS only.** Android (prebuild, adapting the iOS-only surfaces `ActionSheetIOS` / `Alert.prompt` / `formSheet`, emulator job) moves to the new sibling story **10-6-android-parity-and-maestro** (Lesson 2026-06-05: a scope expansion into a new subsystem is split). The epic summary gets a superseding "Realized scope" note.
- **Parity catalog = the 42 `src/components/<Name>/` folders.** The 33 primitives are out of scope for this story (follow-up); the coverage meta-test enumerates the components folder, so any new component must join the catalog or be exempted with a reason.
- **`fontFamily` and box spacing are not compared** by the text gate: font family names differ by construction (`Geist` on web vs `Geist_600SemiBold` faces on native) and view spacing has no text anchor — both are covered by the goldens.
- **Maestro moves to `apps/mobile/.maestro/`** — EAS treats `apps/mobile` (where `eas.json` lives) as the project root.
- **Out of scope:** Android (10-6), primitives parity, authenticated E2E against a real backend (flows run in deterministic preview mode), making the EAS check a required status.

### Existing code at write time (Step-0 verbatim quotes)

`apps/mobile/eas.json` (full, current — replaced in T11):

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "autoIncrement": true
    },
    "preview": {
      "distribution": "internal",
      "autoIncrement": true
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {},
    "development": {}
  }
}
```

`.maestro/smoke.yaml` (full, current — deleted in T8; `"Design System"` no longer exists anywhere in `apps/mobile/{app,components,lib}`):

```yaml
appId: app.pekulo.mobile
---
- launchApp:
    clearState: true
- assertVisible: "Patrimoine total"
- tapOn: "Transactions"
- assertVisible: "Solde du mois"
- tapOn: "Mensuel"
- assertVisible: "Épargne nette"
- tapOn: "Portefeuille"
- assertVisible: "Plus-value latente"
- tapOn: "Immobilier"
- assertVisible: "Équité nette"
- tapOn: "Cap"
- tapOn:
    id: "open-settings-btn"
- assertVisible: "Design System"
```

`packages/ui/package.json` `exports` (current — T2 adds `./parity`):

```json
  "exports": {
    ".": {
      "react-native": {
        "types": "./src/index.native.ts",
        "default": "./src/index.native.ts"
      },
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./client": "./src/client.ts",
    "./tamagui-config": "./src/config/tamagui.ts",
    "./reset.css": "./public/reset.css",
    "./generated.css": "./public/tamagui.generated.css"
  },
```

`apps/mobile/jest.config.js` `moduleNameMapper` (current excerpt — T2 adds `^@pekulo/ui/parity$`):

```js
    "^@pekulo/ui$": "<rootDir>/../../packages/ui/src/index.native.ts",
    "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
    "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
```

`packages/ui/test/setup.tsx` — why the web baseline does NOT reuse `renderWithTamagui` (current):

```tsx
function TamaguiTestProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <TamaguiProvider
      config={config}
      defaultTheme="pekulo-dark"
      disableInjectCSS
      disableRootThemeClass
    >
      {children}
    </TamaguiProvider>
  );
}
```

The same file installs a global `window.matchMedia` that reports `prefers-reduced-motion: reduce` — it applies to `web-text-styles.test.tsx` too (vitest `setupFiles`), so count-ups render settled; T5 installs the identical stub on native.

`apps/mobile/lib/supabase/client.ts` (current — preview mode relied on by the `e2e-test` profile):

```ts
function readSupabaseUrl(env?: Record<string, string | undefined>): string | undefined {
  return (env ? env.EXPO_PUBLIC_SUPABASE_URL : process.env.EXPO_PUBLIC_SUPABASE_URL)?.trim();
}

function readSupabaseAnonKey(env?: Record<string, string | undefined>): string | undefined {
  return (
    env ? env.EXPO_PUBLIC_SUPABASE_ANON_KEY : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
}

export function isSupabaseConfigured(env?: Record<string, string | undefined>): boolean {
  return Boolean(readSupabaseUrl(env) && readSupabaseAnonKey(env));
}
```

`apps/mobile/lib/orpc/client.ts` (current — why a blank API URL is safe in the release simulator build: the URL is resolved lazily per request, and no request fires while unauthenticated):

```ts
export function getApiBaseUrl(
  env?: Record<string, string | undefined>,
  isDev: boolean = __DEV__,
): string {
  // Direct member read lets babel-preset-expo statically inline EXPO_PUBLIC_API_BASE_URL in native bundles.
  const raw = (env ? env.EXPO_PUBLIC_API_BASE_URL : process.env.EXPO_PUBLIC_API_BASE_URL)?.trim();
  if (!raw) {
    // The loopback default only makes sense against a local API in development;
    // a release build would send the Bearer to the phone itself over cleartext.
    if (isDev) return DEFAULT_API_BASE_URL;
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not set");
  }
```

```ts
  return new RPCLink({
    url: () => `${resolveBaseUrl()}/rpc/v1`,
```

`apps/mobile/lib/auth/auth-context.tsx` (current):

```ts
  const configured = isSupabaseConfigured();
  const enforceAuth = requireAuth ?? configured;
```

`apps/mobile/components/tab-stack-layout.tsx` — the Cap settings button Maestro targets (current):

```tsx
export function SettingsHeaderButton({ testID = "header-settings-btn" }: { testID?: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  // Same profile glyph as the native toolbar button on the other tabs.
  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.actions.openSettings")}
        hitSlop={4}
        testID={testID}
```

and `apps/mobile/app/(tabs)/(cap)/index.tsx` passes `settingsTestID="open-settings-btn"`.

`apps/mobile/lib/actions.ts` — the preview prompt `preview-guard.yaml` asserts (current):

```ts
  if (error instanceof PreviewModeError) {
    Alert.alert(tNow("common.errors.previewTitle"), tNow("common.errors.previewMessage"), [
      { text: tNow("common.actions.later"), style: "cancel" },
      { text: tNow("common.actions.signIn"), onPress: goToLogin },
    ]);
```

with `previewTitle: "Mode aperçu"`, `previewMessage: "Connectez-vous pour enregistrer des modifications sur votre compte."`, `later: "Plus tard"`, `signIn: "Se connecter"` (`lib/i18n/messages/common.ts`). Tab labels: `Cap`, `Transactions`, `Mensuel`, `Portefeuille`, `Immobilier`; figures `Patrimoine total` (cap), `Solde du mois` (transactions), `Épargne nette` (monthly), `Plus-value latente` (portfolio), `Équité nette` (realestate); Paramètres sections `Compte`, `Apparence`.

`.oxfmtrc.json` `ignorePatterns` (current excerpt — T10 adds two entries after this line):

```json
    "apps/mobile/expo-env.d.ts",
```

`apps/mobile/README.md` (current excerpt — the last two lines inside the "Verification (from Repo Root)" bash block, followed by that block's closing fence; replaced in T12):

```bash
# Maestro E2E smoke (requires booted iOS Simulator with Dev Build installed)
maestro test .maestro/smoke.yaml
```

`docs/architecture.md` Test pyramid bullet (current, line 257):

```markdown
- **Test pyramid (D6):** **Vitest** (unit + integration, Web Crypto polyfill via `happy-dom`) for `apps/web` + `packages/*` ; **bun test** for `apps/api` modules (handler / service / repository / whole-module wired with real test DB) ; **Playwright** (E2E web; mobile E2E V1.5 via Maestro on Expo) ; **vitest-axe** (a11y) ; **Lighthouse CI** (perf budgets) ; **pytest** (`apps/prices`). Satisfies NFR-1/2/3/4/5/6/7/8/18/21/22. **See ADR-0002.**
```

`docs/architecture.md` FR table (current, line 1139):

```markdown
| FR-56 | Visual parity web ↔ mobile via per-component snapshot           | `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx` + Maestro mobile snapshot suite (V1.5)            |
```

`docs/epics.md` story 10-5 block (current — T13 appends after its last line, `**Complexity:** M`, which is immediately followed by the blank line and `## Epic 11: Public-ramp readiness`):

```markdown
#### Story 10-5-mobile-parity-and-maestro

**Ticket:** [#156](https://github.com/yabafre/pekulo/issues/156)
**Title:** Automated iOS/Android pixel-diff parity assertions and CI Maestro E2E suite

**Depends on:** 10-3-ui-native-parity, 10-4-mobile-auth-and-orpc

**As a** Pekulo developer, **I want** visual parity checks against the `10-1` web snapshots and the full Maestro E2E suite wired into CI, **so that** visual regressions and navigation breaks are caught before App Store / Play Store release.

**Covered FRs:** FR-56 (parity verification & Maestro CI)
**Complexity:** M
```

`docs/state.yaml` (current):

```yaml
    10-5-mobile-parity-and-maestro: {status: pending, depends_on: [10-3-ui-native-parity, 10-4-mobile-auth-and-orpc], ticket: "#156", worktree: null}
```

Write-time spike evidence (run on this branch, files removed after): web — `PekuloStat tone="gain"` renders `<span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Net</span><span class="is_Text _col-success _fs-f-size-h2 _fw-600 _mt-c-space-1">+1 050 €</span>`; with CSS injection on, rules `:root ._col-colorTertia3655 => color: var(--colorTertiary)`, `:root ._fs-f-size-h2 => font-size: var(--f-size-h2)`, `:root ._ls-0--5px => letter-spacing: 0.5px`, `:root ._fw-600 => font-weight: 600`, and `:root .font_body, :root .t_lang-body-default .font_body => --f-size-xs: 12px; … --f-size-h2: 20px`; `config.themes["pekulo-dark"].colorTertiary = { val: "#808080", variable: "var(--colorTertiary)" }`; `config.tokens` groups are `radius`, `zIndex`, `space`, `size` (no colour tokens). Native (Jest) — the same component gives `Net {"fontSize":12,"letterSpacing":0.5,"color":"#808080"}` and `+1 050 € {"color":"#00d26a","fontSize":20,"fontWeight":"600","marginTop":4}`; without the reduced-motion stub, `PekuloDonut` logs an unwrapped-`act` rAF warning (hence the T5 stub).

### File structure design (3-bullet decision template per file)

- `packages/ui/src/parity/types.ts` — **Responsibility:** the parity data shapes. **In:** `react` types. **Out:** `ParityTheme`, `PARITY_THEMES`, `ParityCase`, `TextStyleRecord`, `ParityBaseline`.
- `packages/ui/src/parity/text-styles.ts` — **Responsibility:** normalise style values and diff web vs native records. **In:** `./types`. **Out:** `PARITY_PROPS`, `normalizeColor`, `normalizeNumber`, `normalizeFontWeight`, `diffTextStyles`, `TextStyleDiff`.
- `packages/ui/src/parity/text-styles.test.ts` — **Responsibility:** unit-test the normalisers and diff rules. **In:** `./text-styles`. **Out:** vitest results.
- `packages/ui/src/parity/icons.ts` / `icons.native.ts` — **Responsibility:** the four catalog icons per platform. **In:** `lucide-react` / `lucide-react-native`. **Out:** `Check`, `Monitor`, `Moon`, `Sun`.
- `packages/ui/src/parity/cases.tsx` — **Responsibility:** the platform-agnostic list of renders to compare. **In:** the 42 component folders, `./icons`, `tamagui` `Text`. **Out:** `PARITY_CASES`, `PARITY_EXEMPT_COMPONENTS`.
- `packages/ui/src/parity/index.ts` — **Responsibility:** the `@pekulo/ui/parity` entry. **In:** `./types`, `./text-styles`, `./cases`. **Out:** re-exports.
- `packages/ui/src/parity/parity-coverage.meta.test.ts` — **Responsibility:** fail when a component lacks a case / golden. **In:** filesystem `src/components/`, `./cases`. **Out:** vitest results.
- `packages/ui/src/parity/web-text-styles.test.tsx` — **Responsibility:** resolve and freeze web text styles. **In:** `../config/tamagui`, `./cases`, `./text-styles`. **Out:** `__baseline__/web-text-styles.json` (file snapshot).
- `packages/ui/src/parity/__baseline__/web-text-styles.json` — **Responsibility:** the committed web reference. **In:** generated by vitest `-u`. **Out:** read by the native gate.
- `packages/ui/package.json` — **Responsibility:** package exports. **Change:** adds `./parity`.
- `apps/mobile/jest.config.js` — **Responsibility:** Jest resolution. **Change:** maps `@pekulo/ui/parity`.
- `apps/mobile/__tests__/helpers/parity-allowlist.ts` — **Responsibility:** reviewed native divergences + key format. **In:** parity types. **Out:** `PARITY_ALLOWED_DIVERGENCE`, `divergenceKey`.
- `apps/mobile/__tests__/ds-token-parity.test.tsx` — **Responsibility:** compare native renders with the web baseline. **In:** baseline JSON, `@pekulo/ui`, `@pekulo/ui/parity`, allow-list. **Out:** Jest results.
- `apps/mobile/lib/ds-gallery.ts` — **Responsibility:** gallery flag + theme param parsing. **In:** `process.env.EXPO_PUBLIC_DS_GALLERY`. **Out:** `isDsGalleryEnabled`, `resolveGalleryTheme`.
- `apps/mobile/app/ds/[case].tsx` — **Responsibility:** render one parity case for screenshots. **In:** route params, `@pekulo/ui/parity`, `./lib/ds-gallery`, `tamagui` `Theme`/`View`. **Out:** the `ds-case-<id>` screen or a redirect.
- `apps/mobile/__tests__/ds-gallery-screen.test.tsx` — **Responsibility:** gallery route behaviour. **Out:** Jest results.
- `apps/mobile/.maestro/config.yaml` + `flows/{smoke,navigation,preview-guard}.yaml` — **Responsibility:** hand-written E2E journeys in preview mode. **In:** app texts / testIDs. **Out:** Maestro results.
- `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts` — **Responsibility:** generate + freshness-check the ds-gallery flow. **In:** `PARITY_CASES`. **Out:** `flows/ds-gallery.yaml`.
- `apps/mobile/.maestro/flows/ds-gallery.yaml` — **Responsibility:** one golden assert per component. **In:** generated. **Out:** Maestro results / screenshots.
- `apps/mobile/.maestro/goldens/ios/*.png` — **Responsibility:** iOS reference images. **In:** captured on EAS (T15). **Out:** `assertScreenshot` baselines.
- `apps/mobile/eas.json` — **Responsibility:** EAS build profiles. **Change:** adds `e2e-test`.
- `apps/mobile/.eas/workflows/e2e-ios.yml` — **Responsibility:** PR-triggered build + Maestro. **Out:** EAS check.
- `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml` — **Responsibility:** manual golden capture. **Out:** screenshot artifacts.
- `.oxfmtrc.json` — **Change:** ignores the generated flow dir and the baseline dir.
- `apps/mobile/README.md`, `docs/epics.md`, `docs/state.yaml`, `docs/architecture.md` — **Responsibility:** doc-sync (Lesson 2026-05-31 / 2026-06-05).
- `.maestro/smoke.yaml` — **Deleted** (moved and rewritten).

### Architecture & Lessons Applied

- **Platform-split modules (epic-10 context, 10-2/10-3):** `icons.ts` / `icons.native.ts` follow the established `*.native.ts` pattern; `packages/ui/tsconfig.json` already excludes `**/*.native.{ts,tsx}` from the web typecheck, and `apps/mobile/tsconfig.json` resolves them via `moduleSuffixes`.
- **RSC-safe barrels (lesson 2026-05-07):** `cases.tsx` imports raw `tamagui` and every component — it is NEVER re-exported from `src/index.ts` / `src/index.native.ts`; it lives behind the `./parity` subpath. This also keeps `ds-coverage.meta.test.ts` (which enumerates `src/index.ts`) untouched.
- **Class-killer meta-test (lesson 2026-06-05):** `parity-coverage.meta.test.ts` enumerates the components folder like `ds-coverage.meta.test.ts` does, and T3 proves it fails on a removed case (lesson 2026-06-15: show the gate bite).
- **10-1 snapshots are the reference:** no web component source and no `*.snapshot.test.tsx` changes in this story (T6 rule 4, T14 step 8).
- **`$accent` / gain-loss tokens (lesson 2026-05-07):** a T6 fix must copy the web token exactly — never introduce `$success` / `$danger` on non-monetary text to "make it match".
- **Test runners (lesson 2026-05-07):** `@pekulo/ui` = vitest, `@pekulo/mobile` = Jest; CI fans out via `bun --filter='*' run test` (`test-unit` job), which already picks up the new files — no `pr.yml` change.
- **Workspace filters (lesson 2026-05-19):** always `bun --filter='@pekulo/…'`, quoted. Never `bun --cwd` (lesson 2026-05-05); use `cd <dir> && …`.
- **Prisma postinstall needs `DATABASE_URL` (lesson 2026-05-05):** mirrored into the `e2e-test` profile env.
- **Bun pin 1.3.14 (memory, PR #159):** pinned in the `e2e-test` profile and the README.
- **Typecheck before commit (lesson 2026-06-01):** pre-commit hooks do not run `tsc`; T2, T7, and T14 run it.
- **iOS 26 / Expo pitfalls (memory):** flows use testIDs and visible text, never top-right coordinate taps (dev-tools button); the e2e build is Release (no dev-client UI).
- **Doc-sync in the same change (lessons 2026-05-31, 2026-06-05):** T13.
- **EAS facts verified at write time** (docs.expo.dev/eas/workflows: syntax, pre-packaged-jobs, examples/e2e-tests): `.eas/workflows/*.yml` next to `eas.json`; `on.pull_request.{branches,paths}` supported; `type: build` output `build_id` via `${{ needs.<job>.outputs.build_id }}`; `type: maestro` params `build_id`, `flow_path` (string or list), `retries`, `record_screen`; `MAESTRO_`-prefixed env vars reach Maestro; `schedule` is paid-plan only; the maestro job is alpha; `eas workflow:run <file>` runs any workflow manually. **Not documented, verified in T15:** the default iOS simulator device, how `assertScreenshot` resolves `path`, and where `takeScreenshot` lands in the artifact.
- **Maestro facts verified at write time** (docs.maestro.dev): `assertScreenshot` exists with `path`, `cropOn`, `thresholdPercentage` (default 95; this story uses 98); `takeScreenshot` with `path` (no extension) + `cropOn`; `openLink`; `runFlow` with `when`; `extendedWaitUntil` (ms); `waitForAnimationToEnd` (does not fail on timeout); iOS shows an "Open" confirmation on the first custom-scheme deep link (handled in every case block).

### Testing

- **Web (vitest):** `cd packages/ui && bunx vitest run src/parity` — 3 files.
- **Native (Jest):** `cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx __tests__/ds-gallery-screen.test.tsx __tests__/maestro-ds-gallery-flow.test.ts`.
- **E2E (Maestro on EAS):** T15 only — the dev agent has no Maestro CLI, no EAS account, and no Simulator build.
- **Regression:** the 10-1 web snapshots and `tamagui.generated.css` must stay byte-identical (T14).

### Dependencies

- No new npm dependency: `lucide-react`, `lucide-react-native`, `tamagui`, `@testing-library/react`, `@testing-library/react-native`, `jest-expo`, and `vitest` are already declared.
- Tooling run through `bunx` without install: `eas-cli@latest` (T15). Maestro runs on EAS's runner image.
- External: an Expo account with EAS Workflows, the Expo GitHub app on `yabafre/pekulo` (T15, user).

### Commit conventions

`feat(#156): …` / `test(#156): …` / `fix(#156): …` / `ci(#156): …` / `chore(#156): …` / `docs(#156): …`. Stage explicit paths only (never `git add .`; `skills-lock.json` and `.claude/skills/*` are the user's unrelated changes and must never be committed in this story). PR: `gh pr create --base main --title "feat(#156): 10-5 web↔native parity gate, iOS DS goldens, Maestro on EAS" --body "Closes #156"`.

## File List

**Create**

- `packages/ui/src/parity/types.ts`
- `packages/ui/src/parity/text-styles.ts`
- `packages/ui/src/parity/text-styles.test.ts`
- `packages/ui/src/parity/icons.ts`
- `packages/ui/src/parity/icons.native.ts`
- `packages/ui/src/parity/cases.tsx`
- `packages/ui/src/parity/index.ts`
- `packages/ui/src/parity/parity-coverage.meta.test.ts`
- `packages/ui/src/parity/web-text-styles.test.tsx`
- `packages/ui/src/parity/__baseline__/web-text-styles.json` (generated)
- `apps/mobile/__tests__/helpers/parity-allowlist.ts`
- `apps/mobile/__tests__/ds-token-parity.test.tsx`
- `apps/mobile/lib/ds-gallery.ts`
- `apps/mobile/app/ds/[case].tsx`
- `apps/mobile/__tests__/ds-gallery-screen.test.tsx`
- `apps/mobile/.maestro/config.yaml`
- `apps/mobile/.maestro/flows/smoke.yaml`
- `apps/mobile/.maestro/flows/navigation.yaml`
- `apps/mobile/.maestro/flows/preview-guard.yaml`
- `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts`
- `apps/mobile/.maestro/flows/ds-gallery.yaml` (generated)
- `apps/mobile/.maestro/goldens/ios/.gitkeep`
- `apps/mobile/.maestro/goldens/ios/*.png` (42, captured in T15)
- `apps/mobile/.eas/workflows/e2e-ios.yml`
- `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml`

**Modify**

- `packages/ui/package.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/eas.json`
- `apps/mobile/app.json` (T15, written by `eas init`)
- `apps/mobile/README.md`
- `.oxfmtrc.json`
- `docs/epics.md`
- `docs/state.yaml`
- `docs/architecture.md`
- `packages/ui/src/components/*/*.native.tsx` (only those T6 rule 1/3 requires)

**Delete**

- `.maestro/smoke.yaml`

## Dev Agent Record

- **Model:** Gemini 4 Neon (High)
- **Started:** 2026-11-22T19:27:00Z
- **Completed:** 2026-11-22T21:25:00Z

### Summary

T1–T15 implemented and verified across `@pekulo/ui`, `@pekulo/mobile`, `@pekulo/web`, Maestro E2E on iPhone 17 Pro Simulator (iOS 26.5), EAS project init, and docs.

- **T6 triage tally:** **0** native component fixes required (58/59 parity tests passed on first run); **6** allow-list entries added in `apps/mobile/__tests__/helpers/parity-allowlist.ts` for `CategoryPicker.closed` (3 closed-sheet option `<Text>` nodes × 2 themes mounted off-screen by `PekuloSelect.native.tsx`'s `<TamaSelect.Adapt platform="touch">` for `Select.Value` registration, no visual output while closed; `CategoryPicker.tsx` has no `.native.tsx` sibling).
- **T15 live execution (Option C, user-approved):** `eas login` + `eas init` linked `@skinx/pekulo` (`5ada2dbf-0974-4ba6-9807-fd632b3299ca`, commit `80cb4ce`). Running `e2e-ios-update-goldens.yml` on EAS surfaced that `type: maestro` requires a paid Expo plan (`Running maestro_test jobs requires a paid plan`). Per Alex's Option C decision, the EAS profile and `.eas/workflows/*.yml` stay ready in-repo while live capture and full verification ran locally on the booted iPhone 17 Pro Simulator (Release build with `EXPO_PUBLIC_DS_GALLERY=1`, Maestro CLI `2.12.1`): all 42 cropped iOS goldens captured, spot-checked visually (`PekuloStat.gain.png`, `PekuloDonut.centered.png`, `PekuloErrorBoundary.fallback.png`), committed (`f2bb8c5`), and all 4 Maestro flows (`smoke`, `navigation`, `preview-guard`, `ds-gallery` 42/42 `assertScreenshot` at 98%) passed `4/4` in `6m 58s`.

### Files changed

Created:
- `packages/ui/src/parity/types.ts`
- `packages/ui/src/parity/text-styles.ts`
- `packages/ui/src/parity/text-styles.test.ts`
- `packages/ui/src/parity/icons.ts`
- `packages/ui/src/parity/icons.native.ts`
- `packages/ui/src/parity/cases.tsx`
- `packages/ui/src/parity/index.ts`
- `packages/ui/src/parity/parity-coverage.meta.test.ts`
- `packages/ui/src/parity/web-text-styles.test.tsx`
- `packages/ui/src/parity/__baseline__/web-text-styles.json`
- `apps/mobile/__tests__/helpers/parity-allowlist.ts`
- `apps/mobile/__tests__/ds-token-parity.test.tsx`
- `apps/mobile/lib/ds-gallery.ts`
- `apps/mobile/app/ds/[case].tsx`
- `apps/mobile/__tests__/ds-gallery-screen.test.tsx`
- `apps/mobile/.maestro/config.yaml`
- `apps/mobile/.maestro/flows/smoke.yaml`
- `apps/mobile/.maestro/flows/navigation.yaml`
- `apps/mobile/.maestro/flows/preview-guard.yaml`
- `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts`
- `apps/mobile/.maestro/flows/ds-gallery.yaml`
- `apps/mobile/.maestro/goldens/ios/.gitkeep`
- `apps/mobile/.maestro/goldens/ios/*.png` (42 iOS DS goldens captured on iPhone 17 Pro Simulator)
- `apps/mobile/.eas/workflows/e2e-ios.yml`
- `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml`

Modified:
- `packages/ui/package.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/eas.json`
- `apps/mobile/app.json`
- `apps/mobile/README.md`
- `.oxfmtrc.json`
- `docs/epics.md`
- `docs/state.yaml`
- `docs/architecture.md`

Deleted:
- `.maestro/smoke.yaml`

### Deviations

- **Strict TS (`noUncheckedIndexedAccess`) narrowing:** narrowed regex capture groups (`hex?.[1]`, `fn?.[1]`, `match?.[1]`) and optional baseline/theme lookups in `text-styles.ts` and `web-text-styles.test.tsx` to satisfy `@pekulo/ui` `tsc --noEmit`.
- **No `@types/node` in `@pekulo/mobile`:** `ds-token-parity.test.tsx` imports `web-text-styles.json` as a JSON module instead of `node:fs`/`node:path`/`__dirname`, and `maestro-ds-gallery-flow.test.ts` loads `node:fs`/`node:path` via typed `require(...)` and resolves `MOBILE_ROOT` from `require.resolve("../package.json")` (zero new npm dependencies, zero `no-underscore-dangle` warnings).
- **`no-await-in-loop` clean in `ds-token-parity.test.tsx`:** extracted `checkCaseTheme` and chained `PARITY_THEMES.reduce(...)` sequentially so mobile oxlint stays at 0 warnings.
- **`View` import in `apps/mobile/app/ds/[case].tsx`:** imported `View` from `@pekulo/ui/client` (matching every other screen in `apps/mobile`) instead of `"tamagui"`, because `@tamagui/babel-plugin` rewrites flattened `"tamagui"` `View` imports to `@tamagui/core` which is not hoisted in Bun isolated installs.
- **EAS `eas.json` empty env values rejected by EAS schema (`42a0630`):** `eas-cli` validates `build.e2e-test.env` against Joi and rejects empty strings `""` for `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_BASE_URL`. Omitted those three keys from `build.e2e-test.env` (keeping `EXPO_PUBLIC_DS_GALLERY: "1"` and `DATABASE_URL`): with no `environment` scope and `.env` gitignored, they stay `undefined` on EAS builds so `isSupabaseConfigured()` remains `false` (deterministic preview mode).
- **EAS `type: maestro` requires paid Expo plan → Free-plan custom `runs_on: macos-medium` job:** `eas workflow:run` rejected pre-packaged `type: maestro` (`Running maestro_test jobs requires a paid plan`). Probed `runs_on: macos-medium` on `@skinx/pekulo` (succeeded in 39s; macOS 26.6.2, `/Users/expo/.maestro/bin/maestro` pre-installed, iPhone 18 Pro Simulator available). Updated `.eas/workflows/e2e-ios.yml` and `.eas/workflows/e2e-ios-update-goldens.yml` to use `runs_on: macos-medium` custom jobs (`eas/checkout` + `eas/download_build` + `xcrun simctl` + `maestro test` + `eas/upload_artifact`) so both workflows run on the Expo Free plan. The 42 initial iOS goldens and full 4-flow Maestro suite were also verified live locally on iPhone 17 Pro Simulator (`iOS 26.5`).
- **Visual verification (Step 5):** `mcp__react-grab-mcp__get_element_context` is unavailable in this environment (and on React Native); visual verification was performed directly on the captured iOS Simulator golden PNGs (`PekuloStat.gain.png`, `PekuloDonut.centered.png`, `PekuloErrorBoundary.fallback.png`).

### Test output

Captured 2026-11-22 (T14 sweep + T15 live Maestro):
- `bun run typecheck` — exit 0 (`Tasks: 10 successful, 10 total`)
- `bun run lint` — exit 0 (`Found 3 warnings and 0 errors.` — only the 3 pre-existing warnings in `apps/web`: `recent-activity-section.tsx`, `dashboard-edit-context.tsx`, `axe-routes.spec.ts`)
- `bun run format:check` — 0 issues under `apps/`, `packages/`, `docs/`; only the 10 pre-existing untracked `.claude/skills/{ios-design,ui-taste}` files flagged
- `bun --filter='@pekulo/ui' run test` — exit 0 (`Test Files 162 passed (162)`, `Tests 352 passed | 1 skipped (353)`)
- `bun --filter='@pekulo/mobile' run test` — exit 0 (`Test Suites: 16 passed, 16 total`, `Tests: 192 passed, 192 total`)
- `bun --filter='@pekulo/web' run test` — exit 0 (`Test Files 125 passed (125)`, `Tests 435 passed (435)`)
- `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css` — exit 0 (zero diff)
- `git diff main --stat -- packages/ui/src/components packages/ui/src/primitives | grep -v '\.native\.tsx'` + `*.snapshot.test.tsx` — empty (zero web component or 10-1 snapshot changes)
- `maestro test --device BCED57F1-C32B-4828-9513-7382DFE0D5FB -e MAESTRO_UPDATE_GOLDENS=true ... ds-gallery.yaml` — exit 0, 42/42 iOS PNG goldens captured
- `maestro test --device BCED57F1-C32B-4828-9513-7382DFE0D5FB apps/mobile/.maestro` — exit 0 (`4/4 Flows Passed in 6m 58s`: `Navigation` 11s, `DS gallery — iOS goldens` 6m 20s, `Preview guard` 12s, `Smoke` 15s)
