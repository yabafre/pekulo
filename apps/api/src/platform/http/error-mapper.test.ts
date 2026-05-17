// apps/api/src/platform/http/error-mapper.test.ts
// Covers AC-3: PekuloError → 4xx, native Error → 500 sanitised, non-Error throw → 500.
// Caller passes a stable requestId per request (see app.ts review F3 fix);
// the mapper echoes it back inside `body.data` so the wire JSON conforms
// to oRPC's `isORPCErrorJson` shape (no extra top-level keys allowed).

import { describe, expect, test } from "bun:test";

import { PekuloError } from "../../common/errors";
import { mapErrorToOrpcResponse } from "./error-mapper";

describe("mapErrorToOrpcResponse", () => {
  // Caller-provided id; the mapper echoes it back. Using a stable literal
  // makes the assertions trivial — no regex matching, no wall-clock
  // entropy in the test path.
  const REQUEST_ID = "00000000-0000-4000-8000-000000000001";

  test("PekuloError UNAUTHORIZED → 401 with code+message preserved + caller requestId", () => {
    const result = mapErrorToOrpcResponse(
      new PekuloError("UNAUTHORIZED", "no session"),
      REQUEST_ID,
    );
    expect(result.status).toBe(401);
    expect(result.body.defined).toBe(false);
    expect(result.body.code).toBe("UNAUTHORIZED");
    expect(result.body.status).toBe(401);
    expect(result.body.message).toBe("no session");
    expect(result.body.data.requestId).toBe(REQUEST_ID);
  });

  test("PekuloError NOT_FOUND → 404 with code+message preserved + caller requestId", () => {
    const result = mapErrorToOrpcResponse(
      new PekuloError("NOT_FOUND", "compass not found"),
      REQUEST_ID,
    );
    expect(result.status).toBe(404);
    expect(result.body.code).toBe("NOT_FOUND");
    expect(result.body.status).toBe(404);
    expect(result.body.message).toBe("compass not found");
    expect(result.body.data.requestId).toBe(REQUEST_ID);
  });

  test("native Error → 500 with sanitised message + caller requestId", () => {
    const result = mapErrorToOrpcResponse(new Error("boom"), REQUEST_ID);
    expect(result.status).toBe(500);
    expect(result.body.code).toBe("INTERNAL");
    expect(result.body.status).toBe(500);
    expect(result.body.message).toBe("internal server error");
    expect(result.body.data.requestId).toBe(REQUEST_ID);
  });

  test("Elysia NotFoundError shape → 404 NOT_FOUND with caller requestId (L11)", () => {
    // Reproduces Elysia 1.4.x's thrown shape on unmatched routes — `name`
    // is the generic "Error" so isPekuloError rejects it; the `code:
    // "NOT_FOUND"` duck-type is the canonical signal.
    const elysiaErr = Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND", status: 404 });
    const result = mapErrorToOrpcResponse(elysiaErr, REQUEST_ID);
    expect(result.status).toBe(404);
    expect(result.body.code).toBe("NOT_FOUND");
    expect(result.body.status).toBe(404);
    expect(result.body.message).toBe("route not found");
    expect(result.body.data.requestId).toBe(REQUEST_ID);
  });

  test("non-Error throw (string) → 500 with sanitised message + caller requestId", () => {
    const result = mapErrorToOrpcResponse("oops", REQUEST_ID);
    expect(result.status).toBe(500);
    expect(result.body.code).toBe("INTERNAL");
    expect(result.body.message).toBe("internal server error");
    expect(result.body.data.requestId).toBe(REQUEST_ID);
  });

  test("body conforms to oRPC isORPCErrorJson shape — no extra top-level keys", () => {
    // @orpc/client@1.14.x isORPCErrorJson allow-lists exactly these keys:
    // defined / code / status / message / data. Any extra (legacy `error:`
    // wrapper or top-level `requestId`) makes the guard return false and
    // the typed code is lost via getMalformedResponseErrorCode().
    const result = mapErrorToOrpcResponse(
      new PekuloError("ACCOUNT_REFERENCED_FK", "fk guard"),
      REQUEST_ID,
    );
    const allowed = new Set(["defined", "code", "status", "message", "data"]);
    const actualKeys = Object.keys(result.body);
    for (const key of actualKeys) {
      expect(allowed.has(key)).toBe(true);
    }
    expect(actualKeys).toContain("defined");
    expect(actualKeys).toContain("code");
    expect(actualKeys).toContain("status");
    expect(actualKeys).toContain("message");
    expect(actualKeys).toContain("data");
  });
});
