// Story 11-1, AC-6 (verbatim from story 11-1-data-export:20):
//   […] Given an unauthenticated browser request to the apps/web `/v1/export`
//   proxy, Then the proxy answers `401` without ever calling apps/api.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ensureRequestContext = vi.fn();
vi.mock("@/lib/orpc/request-context", () => ({
  ensureRequestContext: () => ensureRequestContext(),
}));

const { GET } = await import("./route");

const realFetch = globalThis.fetch;
const prevApiBase = process.env.API_BASE_URL;

beforeEach(() => {
  process.env.API_BASE_URL = "http://api.test";
  ensureRequestContext.mockReset();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.API_BASE_URL = prevApiBase;
});

describe("/v1/export route handler (story 11-1 / FR-49)", () => {
  test("no session → 401 and apps/api is never called", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    ensureRequestContext.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetched).toBe(false);
  });

  test("forwards the session Bearer token to the server-side API_BASE_URL", async () => {
    let calledUrl = "";
    let calledAuth = "";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calledUrl = typeof url === "string" ? url : String(url);
      calledAuth = String((init?.headers as Record<string, string>)?.authorization ?? "");
      return new Response('{"schema_version":"1.0.0"}', { status: 200 });
    }) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({
      accessToken: "tok-123",
      userId: "u",
      email: null,
    });

    const res = await GET();
    expect(calledUrl).toBe("http://api.test/v1/export");
    expect(calledAuth).toBe("Bearer tok-123");
    expect(res.status).toBe(200);
  });

  test("sets a Content-Disposition attachment filename, not a URL path", async () => {
    globalThis.fetch = (async () =>
      new Response('{"schema_version":"1.0.0"}', { status: 200 })) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

    const res = await GET();
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="pekulo-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("upstream 401 is relayed as 401", async () => {
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// Added in aped-review of 11-1 — the three paths nothing exercised.
describe("/v1/export route handler — failure and budget paths", () => {
  test("missing API_BASE_URL → 503 and apps/api is never called", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });
    delete process.env.API_BASE_URL;

    const res = await GET();
    expect(res.status).toBe(503);
    expect(fetched).toBe(false);
  });

  test("an upstream that never answers → 504", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

    const res = await GET();
    expect(res.status).toBe(504);
  });

  test("a non-401 upstream failure is relayed as 502", async () => {
    globalThis.fetch = (async () =>
      new Response("boom", { status: 500 })) as unknown as typeof fetch;
    ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

    const res = await GET();
    expect(res.status).toBe(502);
  });

  test("the 60 s budget covers time-to-first-byte only, never the body transfer", async () => {
    // AC-1 budgets the moment the download STARTS. The original
    // AbortSignal.timeout(60_000) handed to fetch also aborted the BODY, so a
    // large export still streaming at T+60 s was truncated under a 200 — the
    // exact case the chunked design exists for.
    //
    // This asserts the mechanism rather than the elapsed behaviour, on purpose:
    // a 60 s wall-clock wait is not a test, and vi.useFakeTimers() does NOT
    // intercept AbortSignal.timeout (verified — a fake-timer version of this
    // test passed against the broken code). What separates the two
    // implementations observably is that the fixed one owns a cancellable
    // timer and releases it once the headers are in; AbortSignal.timeout owns
    // one nobody can release. So: the signal must come from a controller, and
    // the start-up timer must be cleared before the body is handed back.
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    try {
      let captured: AbortSignal | undefined;
      globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
        captured = init?.signal ?? undefined;
        return new Response('{"schema_version":"1.0.0"}', { status: 200 });
      }) as unknown as typeof fetch;
      ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

      const before = clearSpy.mock.calls.length;
      const res = await GET();

      expect(res.status).toBe(200);
      expect(captured, "no AbortSignal was handed to fetch").toBeInstanceOf(AbortSignal);
      expect(captured!.aborted).toBe(false);
      expect(
        clearSpy.mock.calls.length,
        "the start-up budget was never released — it will abort the body mid-transfer",
      ).toBeGreaterThan(before);
    } finally {
      clearSpy.mockRestore();
    }
  });
});
