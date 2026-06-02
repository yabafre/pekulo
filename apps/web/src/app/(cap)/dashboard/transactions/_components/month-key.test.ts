import { describe, expect, test } from "vitest";
import { formatMonthLong, formatMonthName, isMonthKey, shiftMonth } from "./month-key";

describe("month-key (6-9)", () => {
  test("shiftMonth steps within a year", () => {
    expect(shiftMonth("2026-05", -1)).toBe("2026-04");
    expect(shiftMonth("2026-05", 1)).toBe("2026-06");
  });
  test("shiftMonth rolls over year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  test("shiftMonth keeps the month in 01–12 across multi-month / negative deltas", () => {
    // Sign-safe modulo guard — a negative ordinal must never yield "YYYY-00".
    expect(shiftMonth("2026-03", -5)).toBe("2025-10");
    expect(shiftMonth("2026-02", -2)).toBe("2025-12");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
  });
  test("isMonthKey accepts YYYY-MM, rejects junk + year 0000", () => {
    expect(isMonthKey("2026-02")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-02-01")).toBe(false);
    expect(isMonthKey("0000-01")).toBe(false);
    expect(isMonthKey(null)).toBe(false);
  });
  test("formatMonthLong renders the French month + year", () => {
    expect(formatMonthLong("2026-02")).toBe("février 2026");
  });
  test("formatMonthName renders the full French month name (no truncation)", () => {
    expect(formatMonthName("2026-04")).toBe("avril");
    expect(formatMonthName("2026-02")).toBe("février");
    expect(formatMonthName("2026-09")).toBe("septembre");
  });
});
