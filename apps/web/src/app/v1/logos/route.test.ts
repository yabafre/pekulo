import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Story 6-10 (FR-65) — the public same-origin logo proxy. The auth bypass in
// proxy.ts trusts this handler to leak no user data and to never let the client
// pick the upstream host: it must forward ONLY the opaque `ref`, building the
// apps/api URL server-side from API_BASE_URL (no open-redirect / SSRF surface).
const realFetch = globalThis.fetch;
const prevApiBase = process.env.API_BASE_URL;

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.API_BASE_URL = prevApiBase;
});
beforeEach(() => {
  process.env.API_BASE_URL = "http://api.test";
});

describe("/v1/logos route handler (story 6-10 / FR-65)", () => {
  test("missing ref → 404, no upstream fetch", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const res = await GET(new NextRequest("http://localhost/v1/logos"));
    expect(res.status).toBe(404);
    expect(fetched).toBe(false);
  });

  test("unconfigured API_BASE_URL → 404, no upstream fetch", async () => {
    process.env.API_BASE_URL = "";
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const res = await GET(new NextRequest("http://localhost/v1/logos?ref=YjU3NA"));
    expect(res.status).toBe(404);
    expect(fetched).toBe(false);
  });

  test("forwards ONLY the opaque ref to the server-side API_BASE_URL", async () => {
    let calledUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      calledUrl = typeof url === "string" ? url : ((url as Request).url ?? String(url));
      return new Response("img-bytes", { status: 200, headers: { "content-type": "image/png" } });
    }) as unknown as typeof fetch;
    const res = await GET(new NextRequest("http://localhost/v1/logos?ref=YjU3NA"));
    // The upstream host is NEVER taken from the request — it is API_BASE_URL +
    // the encoded ref only. A client cannot redirect the fetch elsewhere.
    expect(calledUrl).toBe("http://api.test/v1/logos?ref=YjU3NA");
    expect(res).toBeTruthy();
  });
});
