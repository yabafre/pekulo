// AC-3 (verbatim from story 11-6-restore-drill-and-glitchtip:18):
//   Given an unhandled server error in the web tier (render, route handler
//   or server action), When the framework reports it, Then one GlitchTip
//   event is sent with route, router-kind and route-type tags, and its
//   request context carries the path with any query string removed. And
//   given an unhandled browser error, When it fires, Then the browser
//   capture sends it to GlitchTip using the public DSN. And given either
//   DSN is unset, Then the corresponding capture is a no-op. (NFR-27)
//
// AC-4 (verbatim from story 11-6-restore-drill-and-glitchtip:19):
//   Given a Sentry event containing an email, IBAN, raw UUID, JWT, Supabase
//   secret key or Bearer token in its message, exception value, breadcrumb,
//   extra or contexts, When the event payload is prepared for transmission,
//   Then every occurrence is replaced by a typed marker ([redacted:email],
//   [redacted:iban], [redacted:uuid], [redacted:jwt], [redacted:token]),
//   request.headers, request.cookies, request.query_string and request.data
//   are dropped, the request URL loses its query/fragment, user.id survives
//   only when it is the 16-hex hashed user id, and stacktraces are left
//   byte-identical. Sensitive-keyed fields (password, authorization, cookie,
//   token, secret, apiKey, dsn, email, iban, jwt) become [redacted] even when
//   their value is not string-shaped. (NFR-25/27, architecture § Observability discipline)

import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => mocks);

import { buildWebErrorCaptureOptions, captureRequestError, initWebErrorCapture } from "./sentry";

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.init.mockReset();
  mocks.captureException.mockReset();
  mocks.getClient.mockReset();
});

describe("initWebErrorCapture", () => {
  test("is a no-op without GLITCHTIP_DSN", () => {
    vi.stubEnv("GLITCHTIP_DSN", "");
    expect(initWebErrorCapture()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });

  test("initialises with scrubbing and OTel auto-setup disabled", () => {
    vi.stubEnv("GLITCHTIP_DSN", "https://key@glitchtip.example/2");
    expect(initWebErrorCapture()).toBe(true);
    expect(mocks.init).toHaveBeenCalledTimes(1);

    const options = mocks.init.mock.calls[0]?.[0] as {
      dsn: string;
      sendDefaultPii: boolean;
      enableOpenTelemetrySetup: boolean;
      beforeSend: (event: unknown) => unknown;
    };
    expect(options.dsn).toBe("https://key@glitchtip.example/2");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.enableOpenTelemetrySetup).toBe(false);

    const event = {
      message: "alice@example.com",
      request: { url: "https://app.test/dashboard?token=1", cookies: { sb: "1" } },
    };
    options.beforeSend(event);
    expect(event.message).toBe("[redacted:email]");
    expect(event.request).toEqual({ url: "https://app.test/dashboard" });
  });

  test("buildWebErrorCaptureOptions returns undefined for a blank DSN", () => {
    expect(buildWebErrorCaptureOptions("   ")).toBeUndefined();
  });
});

describe("captureRequestError", () => {
  test("is a no-op when the SDK never initialised", () => {
    mocks.getClient.mockReturnValue(undefined);
    captureRequestError(new Error("boom"), { path: "/dashboard" }, {});
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  test("captures with route tags and a query-stripped path", () => {
    mocks.getClient.mockReturnValue({});
    captureRequestError(
      new Error("rsc failed"),
      { path: "/dashboard?token=secret", method: "GET" },
      { routerKind: "App Router", routePath: "/dashboard", routeType: "render" },
    );

    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: {
        route: "/dashboard",
        router_kind: "App Router",
        route_type: "render",
      },
      contexts: { nextjs: { path: "/dashboard", method: "GET" } },
      fingerprint: ["{{ default }}", "/dashboard"],
    });
  });
});
