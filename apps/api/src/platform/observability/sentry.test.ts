// AC-2 (verbatim from story 11-6-restore-drill-and-glitchtip:17):
//   Given an unhandled error that produces a 5xx response in apps/api,
//   When the Elysia error handler runs, Then exactly one event is sent to
//   GlitchTip carrying route, status_code, request_id and method tags,
//   with the payload scrubbed per AC-4 — except typed PekuloErrors, which
//   are captured only when their code is ACCOUNT_PARTIALLY_ERASED.
//   And given GLITCHTIP_DSN is unset, Then capture is a no-op, no network
//   call is attempted and the request path never throws. (NFR-27)
//
// AC-5 (verbatim from story 11-6-restore-drill-and-glitchtip:20):
//   Given the existing OTel SDK initializes first on both server tiers,
//   When the error-capture SDK initializes, Then it does not register a
//   second tracer provider, the existing OTel test suite and web trace path
//   stay green, and no span is emitted twice because error capture took
//   over instrumentation. (ADR-0005 amendment)

import { describe, expect, test } from "bun:test";

import { PekuloError } from "../../common/errors";
import {
  buildErrorCaptureOptions,
  createCaptureApiError,
  initErrorCapture,
  type ApiErrorContext,
  type CaptureApiErrorInput,
  type ErrorCaptureOptions,
} from "./sentry";

const DSN = "https://key@glitchtip.example/1";

function input(overrides: Partial<CaptureApiErrorInput> = {}): CaptureApiErrorInput {
  return {
    error: new Error("boom"),
    request: new Request("http://localhost/rpc/v1/settings/get?token=secret", { method: "POST" }),
    route: "settings.get",
    statusCode: 500,
    requestId: "9f2c4d1e8a7b6c5d4e3f2a1b0c9d8e7f",
    ...overrides,
  };
}

function harness(enabled = true) {
  const calls: Array<{ error: unknown; context: ApiErrorContext }> = [];
  const capture = createCaptureApiError(
    (error, context) => {
      calls.push({ error, context });
      return "event-id";
    },
    () => enabled,
  );
  return { calls, capture };
}

describe("createCaptureApiError", () => {
  test("sends one event for an unhandled 5xx with route, status and request id tags", () => {
    const { calls, capture } = harness();
    const error = new Error("prisma exploded");

    capture(input({ error }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.error).toBe(error);
    expect(calls[0]?.context.tags).toEqual({
      route: "settings.get",
      status_code: "500",
      request_id: "9f2c4d1e8a7b6c5d4e3f2a1b0c9d8e7f",
      method: "POST",
    });
    expect(calls[0]?.context.contexts.pekulo).toEqual({
      route: "settings.get",
      statusCode: 500,
      requestId: "9f2c4d1e8a7b6c5d4e3f2a1b0c9d8e7f",
      method: "POST",
      path: "/rpc/v1/settings/get",
    });
    expect(calls[0]?.context.fingerprint).toEqual(["{{ default }}", "settings.get"]);
  });

  test("ignores 4xx even when the error is untyped", () => {
    const { calls, capture } = harness();
    capture(input({ statusCode: 404 }));
    expect(calls).toHaveLength(0);
  });

  test("ignores typed PekuloErrors except ACCOUNT_PARTIALLY_ERASED", () => {
    const { calls, capture } = harness();
    capture(input({ error: new PekuloError("BANK_PROVIDER_UNAVAILABLE", "bridge down") }));
    capture(input({ error: new PekuloError("ACCOUNT_PARTIALLY_ERASED", "identity erase failed") }));
    expect(calls).toHaveLength(1);
    expect((calls[0]?.error as PekuloError | undefined)?.code).toBe("ACCOUNT_PARTIALLY_ERASED");
  });

  test("is a no-op before init (getClient() === undefined)", () => {
    const { calls, capture } = harness(false);
    capture(input());
    expect(calls).toHaveLength(0);
  });
});

describe("initErrorCapture", () => {
  test("returns false and never calls init without a DSN", () => {
    const calls: ErrorCaptureOptions[] = [];
    const initialised = initErrorCapture(
      { GLITCHTIP_DSN: undefined, NODE_ENV: "test" },
      (options) => {
        calls.push(options);
      },
    );
    expect(initialised).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("initialises with PII scrubbing and OTel auto-setup disabled", () => {
    const calls: ErrorCaptureOptions[] = [];
    const initialised = initErrorCapture({ GLITCHTIP_DSN: DSN, NODE_ENV: "test" }, (options) => {
      calls.push(options);
    });

    expect(initialised).toBe(true);
    expect(calls[0]).toMatchObject({
      dsn: DSN,
      environment: "test",
      sendDefaultPii: false,
      enableOpenTelemetrySetup: false,
    });

    const event = {
      message: "user alice@example.com failed",
      request: { url: "https://api.test/rpc?token=1", headers: { cookie: "sb=1" } },
    };
    const scrubbed = calls[0]?.beforeSend(event) as {
      message?: string;
      request?: Record<string, unknown>;
    };
    expect(scrubbed.message).toBe("user [redacted:email] failed");
    expect(scrubbed.request).toEqual({ url: "https://api.test/rpc" });
  });

  test("buildErrorCaptureOptions trims the DSN and defaults the release", () => {
    const options = buildErrorCaptureOptions({ GLITCHTIP_DSN: ` ${DSN} `, NODE_ENV: "production" });
    expect(options?.dsn).toBe(DSN);
    expect(options?.release).toBe(process.env.npm_package_version ?? "0.0.0");
  });
});
