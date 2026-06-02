import { afterEach, describe, expect, test } from "bun:test";
import { registerLogoRoutes } from "./logos.routes";
import type { LogosService } from "./logos.service";

function svcWith(refResolver: (ref: string) => Promise<string | null>): LogosService {
  return {
    resolveMerchantLogo: async () => null,
    resolveProviderLogo: async () => null,
    enrich: async () => new Map(),
    refToUpstreamUrl: refResolver,
    warmMany: async () => ({ merchants: 0, providers: 0 }),
  };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// AC-5 (verbatim from story 6-10-merchant-logos:42):
//   Given the logo proxy endpoint, When the request reference is unknown or
//   forged (e.g. a URL), Then the endpoint responds 404 and never fetches a
//   caller-supplied address (anti-SSRF).
describe("logos.routes proxy (story 6-10 / AC-5)", () => {
  test("unknown/forged ref → 404, and no upstream fetch is attempted", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const app = registerLogoRoutes({ service: svcWith(async () => null) });
    const res = await app.handle(
      new Request("http://localhost/v1/logos?ref=http://169.254.169.254"),
    );
    expect(res.status).toBe(404);
    expect(fetched).toBe(false); // SSRF guard: never fetch a client-supplied URL
  });

  test("valid ref streams the upstream bytes with an image content-type", async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      })) as unknown as typeof fetch;
    const app = registerLogoRoutes({
      service: svcWith(async () => "https://web.bridgeapi.io/img/banks-logo/sg.svg"),
    });
    const res = await app.handle(new Request("http://localhost/v1/logos?ref=YjU3NA"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image");
  });

  // anti-SSRF defense in depth: even a (poisoned) resolved URL pointing off the
  // logo-CDN allowlist or at http:// is 404'd WITHOUT any outbound fetch.
  test("resolved URL outside the logo-CDN allowlist → 404, no fetch", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const app = registerLogoRoutes({
      service: svcWith(async () => "http://169.254.169.254/latest/meta-data"),
    });
    const res = await app.handle(new Request("http://localhost/v1/logos?ref=YjU3NA"));
    expect(res.status).toBe(404);
    expect(fetched).toBe(false);
  });

  // The proxy relays binary bytes only — a text/HTML body (e.g. a CDN error
  // page) is never relayed under the immutable cache header.
  test("allowed host but text/html content-type → 404", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>error</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;
    const app = registerLogoRoutes({
      service: svcWith(async () => "https://cdn.brandfetch.io/carrefour.fr"),
    });
    const res = await app.handle(new Request("http://localhost/v1/logos?ref=YjU3NA"));
    expect(res.status).toBe(404);
  });

  // web.bridgeapi.io mis-serves bank-logo PNGs as application/octet-stream —
  // the proxy must still relay them (the browser <img> sniffs the bytes).
  test("allowed host serving application/octet-stream (bank logo) → 200", async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })) as unknown as typeof fetch;
    const app = registerLogoRoutes({
      service: svcWith(async () => "https://web.bridgeapi.io/img/banks-logo/fr/demo-bank.png"),
    });
    const res = await app.handle(new Request("http://localhost/v1/logos?ref=Yjo1NzQ"));
    expect(res.status).toBe(200);
  });
});
