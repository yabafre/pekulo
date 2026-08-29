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
