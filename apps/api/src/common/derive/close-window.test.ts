import { describe, expect, it } from "bun:test";
import { closeWindowBounds, isWithinCloseWindow, lastDayOfMonthUTC } from "./close-window";

describe("lastDayOfMonthUTC", () => {
  it("returns 31 for May 2026", () => {
    expect(lastDayOfMonthUTC(2026, 5)).toBe(31);
  });
  it("returns 28 for Feb 2027 (non-leap)", () => {
    expect(lastDayOfMonthUTC(2027, 2)).toBe(28);
  });
  it("returns 29 for Feb 2028 (leap)", () => {
    expect(lastDayOfMonthUTC(2028, 2)).toBe(29);
  });
  it("returns 31 for Dec 2026", () => {
    expect(lastDayOfMonthUTC(2026, 12)).toBe(31);
  });
});

describe("isWithinCloseWindow (May 2026 → window May 27 → June 5)", () => {
  const TARGET_YEAR = 2026;
  const TARGET_MONTH = 5;

  it("returns true at window start (May 27 00:00:00 UTC)", () => {
    expect(
      isWithinCloseWindow(TARGET_YEAR, TARGET_MONTH, new Date("2026-05-27T00:00:00.000Z")),
    ).toBe(true);
  });

  it("returns true mid-window (May 31 12:00 UTC)", () => {
    expect(
      isWithinCloseWindow(TARGET_YEAR, TARGET_MONTH, new Date("2026-05-31T12:00:00.000Z")),
    ).toBe(true);
  });

  it("returns true at window end (June 5 23:59:59.999 UTC)", () => {
    expect(
      isWithinCloseWindow(TARGET_YEAR, TARGET_MONTH, new Date("2026-06-05T23:59:59.999Z")),
    ).toBe(true);
  });

  it("returns false one ms before start (May 26 23:59:59.999 UTC)", () => {
    expect(
      isWithinCloseWindow(TARGET_YEAR, TARGET_MONTH, new Date("2026-05-26T23:59:59.999Z")),
    ).toBe(false);
  });

  it("returns false one ms after end (June 6 00:00:00 UTC)", () => {
    expect(
      isWithinCloseWindow(TARGET_YEAR, TARGET_MONTH, new Date("2026-06-06T00:00:00.000Z")),
    ).toBe(false);
  });
});

describe("isWithinCloseWindow boundary months", () => {
  it("Dec 2026 window = Dec 27 → Jan 5 2027 (year boundary)", () => {
    expect(isWithinCloseWindow(2026, 12, new Date("2026-12-27T00:00:00.000Z"))).toBe(true);
    expect(isWithinCloseWindow(2026, 12, new Date("2027-01-05T23:59:59.999Z"))).toBe(true);
    expect(isWithinCloseWindow(2026, 12, new Date("2027-01-06T00:00:00.000Z"))).toBe(false);
  });

  it("Feb 2028 (leap) window = Feb 25 → Mar 5", () => {
    expect(isWithinCloseWindow(2028, 2, new Date("2028-02-25T00:00:00.000Z"))).toBe(true);
    expect(isWithinCloseWindow(2028, 2, new Date("2028-03-05T23:59:59.999Z"))).toBe(true);
    expect(isWithinCloseWindow(2028, 2, new Date("2028-03-06T00:00:00.000Z"))).toBe(false);
  });

  it("Feb 2027 (non-leap) window = Feb 24 → Mar 5", () => {
    expect(isWithinCloseWindow(2027, 2, new Date("2027-02-24T00:00:00.000Z"))).toBe(true);
    expect(isWithinCloseWindow(2027, 2, new Date("2027-03-05T23:59:59.999Z"))).toBe(true);
  });
});

describe("closeWindowBounds", () => {
  it("May 2026 → May 27 00:00:00.000Z … June 5 23:59:59.999Z", () => {
    expect(closeWindowBounds(2026, 5)).toEqual({
      startIso: "2026-05-27T00:00:00.000Z",
      endIso: "2026-06-05T23:59:59.999Z",
    });
  });

  it("Dec 2026 rolls the end into the next year (Jan 5 2027)", () => {
    expect(closeWindowBounds(2026, 12)).toEqual({
      startIso: "2026-12-27T00:00:00.000Z",
      endIso: "2027-01-05T23:59:59.999Z",
    });
  });

  it("Feb 2028 (leap) → Feb 25 … Mar 5", () => {
    expect(closeWindowBounds(2028, 2)).toEqual({
      startIso: "2028-02-25T00:00:00.000Z",
      endIso: "2028-03-05T23:59:59.999Z",
    });
  });

  it("bounds agree with isWithinCloseWindow at both inclusive edges", () => {
    const { startIso, endIso } = closeWindowBounds(2026, 5);
    expect(isWithinCloseWindow(2026, 5, new Date(startIso))).toBe(true);
    expect(isWithinCloseWindow(2026, 5, new Date(endIso))).toBe(true);
    expect(isWithinCloseWindow(2026, 5, new Date(new Date(startIso).getTime() - 1))).toBe(false);
    expect(isWithinCloseWindow(2026, 5, new Date(new Date(endIso).getTime() + 1))).toBe(false);
  });
});
