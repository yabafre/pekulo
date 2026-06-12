import { afterEach, describe, expect, test, vi } from "vitest";
import { USER_ERROR_MESSAGE, userErrorMessage } from "./user-error-message";

describe("userErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("always returns the generic French message, never the raw error text", () => {
    const raw = new Error("ORPCError: 500 INTERNAL_SERVER_ERROR — connect ECONNREFUSED");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const out = userErrorMessage(raw);

    expect(out).toBe(USER_ERROR_MESSAGE);
    expect(out).toBe("Une erreur est survenue. Réessayez.");
    expect(out).not.toContain("ORPCError");
    expect(out).not.toContain("ECONNREFUSED");
  });

  test("logs the technical detail to console.error with the context label", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = new Error("boom");

    userErrorMessage(raw, "accounts");

    expect(spy).toHaveBeenCalledWith("[accounts]", raw);
  });

  test("falls back to a generic label when no context is given", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = new Error("boom");

    userErrorMessage(raw);

    expect(spy).toHaveBeenCalledWith("[error]", raw);
  });

  test("does not log when the error is null or undefined", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(userErrorMessage(null)).toBe(USER_ERROR_MESSAGE);
    expect(userErrorMessage(undefined)).toBe(USER_ERROR_MESSAGE);
    expect(spy).not.toHaveBeenCalled();
  });
});
