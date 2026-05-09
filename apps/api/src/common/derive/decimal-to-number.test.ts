import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { decimalToNumber } from "./decimal-to-number";

describe("decimalToNumber", () => {
  test("returns fallback when value is null", () => {
    expect(decimalToNumber(null, 42)).toBe(42);
  });

  test("returns fallback when value is undefined", () => {
    expect(decimalToNumber(undefined, 42)).toBe(42);
  });

  test("passes plain number through untouched", () => {
    expect(decimalToNumber(123.45, 0)).toBe(123.45);
  });

  test("unwraps Prisma.Decimal via .toNumber()", () => {
    const d = new Prisma.Decimal("800000.5");
    expect(decimalToNumber(d, 0)).toBe(800000.5);
  });

  test("falls through to Number() for unexpected types", () => {
    expect(decimalToNumber("12.5", 0)).toBe(12.5);
  });
});
