// packages/ui/src/parity/text-styles.ts
// Story 10-5 — value normalisers + the web ↔ native diff. Pure functions so
// both runners (vitest on web, Jest on native) compare with the same rules.
import type { TextStyleRecord } from "./types";

const PARITY_PROPS = ["color", "fontSize", "fontWeight", "letterSpacing"] as const;
type ParityProp = (typeof PARITY_PROPS)[number];

export interface TextStyleDiff {
  text: string;
  /** 0-based index among the nodes that carry the same text. */
  occurrence: number;
  prop: ParityProp | "missing-on-native" | "extra-on-native";
  web: unknown;
  native: unknown;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000 || 0;
}

function parseRgbChannel(part: string): number {
  const numeric = Number.parseFloat(part);
  if (!Number.isFinite(numeric)) return Number.NaN;
  const scaled = part.endsWith("%") ? (numeric / 100) * 255 : numeric;
  return Math.min(255, Math.max(0, Math.round(scaled)));
}

/** Any hex / rgb() / rgba() colour → `rgba(r,g,b,a)` (alpha rounded to 3 decimals). */
export function normalizeColor(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const value = String(input).trim().toLowerCase();
  if (value === "") return null;
  if (value === "transparent") return "rgba(0,0,0,0)";
  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex?.[1]) {
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
  if (fn?.[1]) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return value;
    const [r, g, b] = parts.slice(0, 3).map(parseRgbChannel);
    if (r === undefined || g === undefined || b === undefined) return value;
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return value;
    const rawAlpha = parts[3];
    const parsedAlpha =
      rawAlpha === undefined
        ? 1
        : rawAlpha.endsWith("%")
          ? Number.parseFloat(rawAlpha) / 100
          : Number.parseFloat(rawAlpha);
    if (!Number.isFinite(parsedAlpha)) return value;
    const a = Math.min(1, Math.max(0, parsedAlpha));
    return `rgba(${r},${g},${b},${round3(a)})`;
  }
  return value;
}

/** `12`, `"12px"`, `"0.5px"` → number (3 decimals); non-px / empty / non-finite → null. */
export function normalizeNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? round3(input) : null;
  const trimmed = String(input).trim().toLowerCase();
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))(?:px)?$/.exec(trimmed);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? round3(parsed) : null;
}

/** `600` / `"600"` → `"600"`; `normal` → `"400"`; `bold` → `"700"`. */
export function normalizeFontWeight(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const value = String(input).trim().toLowerCase();
  if (value === "") return null;
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
