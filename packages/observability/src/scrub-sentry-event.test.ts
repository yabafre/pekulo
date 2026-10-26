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

import { describe, expect, test } from "vitest";

import { REDACTED, scrubSentryEvent, type SentryEventLike } from "./scrub-sentry-event";

describe("scrubSentryEvent", () => {
  test("drops headers, cookies, query string and body, and strips the URL query", () => {
    const event: SentryEventLike = {
      request: {
        url: "https://api.pekulo.example/rpc/v1/settings/get?token=secret#frag",
        query_string: "token=secret",
        headers: { authorization: "Bearer abc", cookie: "sb=1" },
        cookies: { sb: "1" },
        data: { iban: "FR7630006000011234567890189" },
      },
    };

    scrubSentryEvent(event);

    expect(event.request).toEqual({ url: "https://api.pekulo.example/rpc/v1/settings/get" });
  });

  test("redacts emails, IBANs, UUIDs, JWTs, Supabase secrets and bearer tokens everywhere", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
    const event: SentryEventLike = {
      message: "failed for alice@example.com on FR7630006000011234567890189",
      transaction: "GET /accounts/8f14e45f-ceea-467f-a8c1-6f0f9d3b2a11",
      exception: {
        values: [
          {
            value: `upstream rejected Bearer ${jwt} and sb_secret_live_abc123`,
            stacktrace: {
              frames: [
                { filename: "apps/api/src/app.ts", lineno: 92, context_line: "alice@example.com" },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        { message: "opened account 8f14e45f-ceea-467f-a8c1-6f0f9d3b2a11 for alice@example.com" },
        { message: "auth", data: { token: "abc", iban: "FR7630006000011234567890189" } },
      ],
      extra: {
        email: "alice@example.com",
        payload: { owner: "8f14e45f-ceea-467f-a8c1-6f0f9d3b2a11" },
      },
      contexts: { account: { label: "alice@example.com" } },
      tags: { user_email: "alice@example.com", request_id: "9f2c4d1e8a7b6c5d4e3f2a1b0c9d8e7f" },
    };

    scrubSentryEvent(event);

    expect(event.message).toBe("failed for [redacted:email] on [redacted:iban]");
    expect(event.transaction).toBe("GET /accounts/[redacted:uuid]");
    expect(event.exception?.values?.[0]?.value).toBe(
      "upstream rejected Bearer [redacted:token] and [redacted:token]",
    );
    expect(event.exception?.values?.[0]?.stacktrace).toEqual({
      frames: [{ filename: "apps/api/src/app.ts", lineno: 92, context_line: "alice@example.com" }],
    });
    expect(event.breadcrumbs).toEqual([
      { message: "opened account [redacted:uuid] for [redacted:email]" },
      { message: "auth", data: { token: REDACTED, iban: REDACTED } },
    ]);
    expect(event.extra?.email).toBe(REDACTED);
    expect(event.extra?.payload).toEqual({ owner: "[redacted:uuid]" });
    expect(event.contexts?.account).toEqual({ label: "[redacted:email]" });
    expect(event.tags?.user_email).toBe(REDACTED);
    expect(event.tags?.request_id).toBe("9f2c4d1e8a7b6c5d4e3f2a1b0c9d8e7f");
  });

  test("keeps user.id only when it is the 16-hex hash, and never keeps email or IP", () => {
    const hashed: SentryEventLike = {
      user: { id: "0123456789abcdef", email: "alice@example.com", ip_address: "203.0.113.4" },
    };
    const raw: SentryEventLike = {
      user: { id: "8f14e45f-ceea-467f-a8c1-6f0f9d3b2a11", username: "alice" },
    };

    scrubSentryEvent(hashed);
    scrubSentryEvent(raw);

    expect(hashed.user).toEqual({ id: "0123456789abcdef" });
    expect(raw.user).toBeUndefined();
  });

  test("survives cycles, Dates and unbounded nesting without throwing", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const event: SentryEventLike = {
      extra: { cyclic, when: new Date("2026-10-23T10:00:00.000Z") },
    };

    expect(() => scrubSentryEvent(event)).not.toThrow();
    expect((event.extra?.cyclic as Record<string, unknown> | undefined)?.self).toBe(REDACTED);
    expect(event.extra?.when).toBe("2026-10-23T10:00:00.000Z");
  });
});
