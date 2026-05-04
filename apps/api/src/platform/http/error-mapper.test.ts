// apps/api/src/platform/http/error-mapper.test.ts
// Covers AC-3: PekuloError → 4xx, native Error → 500 sanitised, non-Error throw → 500.
// Caller passes a stable requestId per request (see app.ts review F3 fix);
// the mapper echoes it back unchanged in the wire body.

import { describe, expect, test } from "bun:test";

import { PekuloError } from "../../common/errors";
import { mapErrorToOrpcResponse } from "./error-mapper";

describe("mapErrorToOrpcResponse", () => {
  // Caller-provided id; the mapper echoes it back. Using a stable literal
  // makes the four assertions trivial — no regex matching, no wall-clock
  // entropy in the test path.
  const REQUEST_ID = "00000000-0000-4000-8000-000000000001";

  test("PekuloError UNAUTHORIZED → 401 with code+message preserved + caller requestId", () => {
    const result = mapErrorToOrpcResponse(new PekuloError("UNAUTHORIZED", "no session"), REQUEST_ID);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(result.body.error.message).toBe("no session");
    expect(result.body.error.requestId).toBe(REQUEST_ID);
  });

  test("PekuloError NOT_FOUND → 404 with code+message preserved + caller requestId", () => {
    const result = mapErrorToOrpcResponse(
      new PekuloError("NOT_FOUND", "compass not found"),
      REQUEST_ID,
    );
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(result.body.error.message).toBe("compass not found");
    expect(result.body.error.requestId).toBe(REQUEST_ID);
  });

  test("native Error → 500 with sanitised message + caller requestId", () => {
    const result = mapErrorToOrpcResponse(new Error("boom"), REQUEST_ID);
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL");
    expect(result.body.error.message).toBe("internal server error");
    expect(result.body.error.requestId).toBe(REQUEST_ID);
  });

  test("non-Error throw (string) → 500 with sanitised message + caller requestId", () => {
    const result = mapErrorToOrpcResponse("oops", REQUEST_ID);
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL");
    expect(result.body.error.message).toBe("internal server error");
    expect(result.body.error.requestId).toBe(REQUEST_ID);
  });
});
