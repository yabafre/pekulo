// AC-2 (verbatim from story 0-4-prisma-setup):
//   `injectPrefixedId("Account", { userId: "u" })` returns an object whose `id`
//   matches the regex `^acc_[0-9A-Za-z]{21}$`.
// base62 is the alphabet half of that contract.

import { describe, expect, it } from "bun:test";
import { generateBase62Id } from "./base62";

describe("generateBase62Id", () => {
  it("returns a string of the requested length", () => {
    expect(generateBase62Id(21)).toHaveLength(21);
    expect(generateBase62Id(8)).toHaveLength(8);
    expect(generateBase62Id(1)).toHaveLength(1);
  });

  it("emits only base62 characters", () => {
    const id = generateBase62Id(100);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("two consecutive calls return different IDs (probabilistic)", () => {
    const a = generateBase62Id(21);
    const b = generateBase62Id(21);
    expect(a).not.toBe(b);
  });

  it("throws RangeError on non-positive length", () => {
    expect(() => generateBase62Id(0)).toThrow(RangeError);
    expect(() => generateBase62Id(-1)).toThrow(RangeError);
  });
});
