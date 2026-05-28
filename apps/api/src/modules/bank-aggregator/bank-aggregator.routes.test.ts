// AC-9 (verbatim from story 5-6):
//   Given the webhook receiver and the refreshConnection route, when a single
//   user issues > 10 refreshConnection calls within 60 seconds, then the
//   request is rejected with HTTP 429 (rate-limit). No DB write occurs and
//   the response is < 100 ms.
//
// This test exercises the pure rate-limit gate (checkRefreshRate). The router
// throws errors.RATE_LIMITED on the 11th call within the window. The contract
// maps RATE_LIMITED to HTTP 429 via ORPC_HTTP_STATUS_BY_CODE.

import { test, expect, beforeEach } from "bun:test";
import { checkRefreshRate, __resetRefreshRateLimitForTests } from "./bank-aggregator.routes";

beforeEach(() => {
  __resetRefreshRateLimitForTests();
});

test("checkRefreshRate allows the first 10 calls in a 60s window (AC-9)", () => {
  const userId = "user-a";
  for (let i = 0; i < 10; i++) {
    expect(checkRefreshRate(userId)).toBe(true);
  }
});

test("checkRefreshRate rejects the 11th call within 60s (AC-9)", () => {
  const userId = "user-a";
  for (let i = 0; i < 10; i++) {
    checkRefreshRate(userId);
  }
  expect(checkRefreshRate(userId)).toBe(false);
});

test("checkRefreshRate isolates rate windows per user (AC-9)", () => {
  for (let i = 0; i < 10; i++) {
    checkRefreshRate("user-a");
  }
  expect(checkRefreshRate("user-a")).toBe(false);
  // user-b has a fresh window — first call passes.
  expect(checkRefreshRate("user-b")).toBe(true);
});

test("RATE_LIMITED PekuloErrorCode surfaces as HTTP 429 via error-mapper (AC-9 wire-shape)", () => {
  // The bank-aggregator refresh-rate-limit path throws a PekuloError with
  // code "RATE_LIMITED" — verify the error-mapper translates it to status 429
  // (RFC 6585). A change to ORPC_HTTP_STATUS_BY_CODE that broke this mapping
  // would silently regress AC-9 wire semantics.
  const { mapErrorToOrpcResponse } = require("../../platform/http/error-mapper") as {
    mapErrorToOrpcResponse: (err: unknown, requestId: string) => { status: number; body: unknown };
  };
  const { PekuloError } = require("../../common/errors") as {
    PekuloError: new (code: string, message: string) => Error;
  };
  const mapped = mapErrorToOrpcResponse(
    new PekuloError("RATE_LIMITED", "rate limit exceeded — retry in 60s"),
    "req-test",
  );
  expect(mapped.status).toBe(429);
});
