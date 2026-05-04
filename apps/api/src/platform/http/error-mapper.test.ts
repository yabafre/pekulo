// apps/api/src/platform/http/error-mapper.test.ts
// Covers AC-3: PekuloError → 4xx, native Error → 500 sanitised, non-Error throw → 500.

import { describe, expect, test } from "bun:test";

import { PekuloError } from "../../common/errors";
import { mapErrorToOrpcResponse } from "./error-mapper";

describe("mapErrorToOrpcResponse", () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  test("PekuloError UNAUTHORIZED → 401 with code+message preserved + requestId", () => {
    const result = mapErrorToOrpcResponse(new PekuloError("UNAUTHORIZED", "no session"));
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(result.body.error.message).toBe("no session");
    expect(result.body.error.requestId).toMatch(UUID_REGEX);
  });

  test("PekuloError NOT_FOUND → 404 with code+message preserved + requestId", () => {
    const result = mapErrorToOrpcResponse(new PekuloError("NOT_FOUND", "compass not found"));
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(result.body.error.message).toBe("compass not found");
    expect(result.body.error.requestId).toMatch(UUID_REGEX);
  });

  test("native Error → 500 with sanitised message + requestId", () => {
    const result = mapErrorToOrpcResponse(new Error("boom"));
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL");
    expect(result.body.error.message).toBe("internal server error");
    expect(result.body.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("non-Error throw (string) → 500 with sanitised message + requestId", () => {
    const result = mapErrorToOrpcResponse("oops");
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL");
    expect(result.body.error.message).toBe("internal server error");
    expect(result.body.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
