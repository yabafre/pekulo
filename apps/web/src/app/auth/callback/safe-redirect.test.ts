import { describe, expect, test } from "vitest";
import { sanitizeNext } from "./safe-redirect";

// CWE-601 — `next` is concatenated onto the origin in route.ts. Anything that
// can resolve to a foreign origin must collapse to the dashboard fallback.
describe("sanitizeNext (open-redirect guard)", () => {
  test("null / undefined / empty → /dashboard", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
    expect(sanitizeNext(undefined)).toBe("/dashboard");
    expect(sanitizeNext("")).toBe("/dashboard");
  });

  test("scheme-relative //host → /dashboard", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
    expect(sanitizeNext("//evil.com/phish")).toBe("/dashboard");
  });

  test("absolute URL → /dashboard", () => {
    expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNext("http://evil.com")).toBe("/dashboard");
    expect(sanitizeNext("javascript:alert(1)")).toBe("/dashboard");
  });

  test("backslash tricks → /dashboard", () => {
    expect(sanitizeNext("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeNext("\\\\evil.com")).toBe("/dashboard");
    expect(sanitizeNext("/path\\x")).toBe("/dashboard");
  });

  test("CR/LF + control chars → /dashboard", () => {
    expect(sanitizeNext("/foo\nbar")).toBe("/dashboard");
    expect(sanitizeNext("/foo\r\nSet-Cookie: x=1")).toBe("/dashboard");
    expect(sanitizeNext("/foo\tbar")).toBe("/dashboard");
  });

  test("valid same-origin relative path is preserved", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/dashboard/transactions")).toBe("/dashboard/transactions");
    expect(sanitizeNext("/")).toBe("/");
  });
});
