// bun:test — llm-categoriser pure parser (story 6-2, AC-1/AC-2).
import { test, expect } from "bun:test";
import { parseCategorisation } from "./llm-categoriser";

const CATS = ["courses", "transport", "sorties"] as const;

test("parses strict JSON into {category, confidence} (AC-1)", () => {
  expect(parseCategorisation('{"category":"courses","confidence":0.91}', CATS)).toEqual({
    category: "courses",
    confidence: 0.91,
  });
});

test("extracts JSON wrapped in code fences / prose", () => {
  const raw = '```json\n{"category":"transport","confidence":0.7}\n```';
  expect(parseCategorisation(raw, CATS)).toEqual({ category: "transport", confidence: 0.7 });
});

test("clamps confidence into [0, 1]", () => {
  expect(parseCategorisation('{"category":"courses","confidence":1.8}', CATS).confidence).toBe(1);
  expect(parseCategorisation('{"category":"courses","confidence":-0.5}', CATS).confidence).toBe(0);
});

test("abstains on a category outside the closed list (AC-2)", () => {
  expect(parseCategorisation('{"category":"crypto","confidence":0.99}', CATS)).toEqual({
    category: null,
    confidence: 0,
  });
});

test("abstains on unparseable garbage (AC-2)", () => {
  expect(parseCategorisation("not json at all", CATS)).toEqual({ category: null, confidence: 0 });
});

test("keeps the category but zeroes a missing / non-numeric confidence", () => {
  expect(parseCategorisation('{"category":"courses"}', CATS)).toEqual({
    category: "courses",
    confidence: 0,
  });
});
