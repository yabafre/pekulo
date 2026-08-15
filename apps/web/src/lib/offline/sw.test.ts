// AC-1 (navigation falls back to cache offline) and AC-5 (mutations are never
// served from cache). Loads apps/web/public/sw.js verbatim and drives its
// listeners against a fake ServiceWorkerGlobalScope.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const ORIGIN = "https://pekulo.test";

interface FetchEvent {
  request: { method: string; url: string; mode?: string };
  respondWith: (response: Promise<unknown>) => void;
}

function loadWorker() {
  const store = new Map<string, string>();
  // Honours `ignoreSearch` the way the real Cache API does — the fake used to
  // key on the full URL unconditionally, which reproduced the bug under test
  // instead of exposing it.
  const stripSearch = (url: string) => url.split("?")[0] ?? url;
  const cache = {
    match: vi.fn(async (request: { url: string }, options?: { ignoreSearch?: boolean }) => {
      if (!options?.ignoreSearch) return store.get(request.url);
      const wanted = stripSearch(request.url);
      for (const [key, value] of store) if (stripSearch(key) === wanted) return value;
      return undefined;
    }),
    // The worker normalises navigation keys to a plain URL string (a valid
    // RequestInfo) so query-string variants share one entry; build assets are
    // still put under their Request.
    put: vi.fn(async (key: string | { url: string }, response: { body: string }) => {
      store.set(typeof key === "string" ? key : key.url, response.body);
    }),
    keys: vi.fn(async () => Array.from(store.keys()).map((url) => ({ url }))),
    delete: vi.fn(async (request: { url: string }) => store.delete(request.url)),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ["pekulo-shell-v1", "pekulo-shell-v0"]),
    delete: vi.fn(async () => true),
  };
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin: ORIGIN },
  };
  const fetchMock = vi.fn();

  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  // eslint-disable-next-line no-new-func
  new Function("self", "caches", "fetch", source)(self, caches, fetchMock);

  return { listeners, self, caches, cache, fetchMock, store };
}

function navigate(url: string): FetchEvent & { responded: () => Promise<unknown> | undefined } {
  let captured: Promise<unknown> | undefined;
  return {
    request: { method: "GET", url, mode: "navigate" },
    respondWith: (response: Promise<unknown>) => {
      captured = response;
    },
    responded: () => captured,
  };
}

let worker: ReturnType<typeof loadWorker>;

beforeEach(() => {
  worker = loadWorker();
});

describe("public/sw.js (story 9-2)", () => {
  test("registers install, activate and fetch listeners", () => {
    expect(worker.listeners.has("install")).toBe(true);
    expect(worker.listeners.has("activate")).toBe(true);
    expect(worker.listeners.has("fetch")).toBe(true);
  });

  test("install takes over immediately", () => {
    worker.listeners.get("install")!({});
    expect(worker.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  test("activate deletes caches from other versions and claims clients", async () => {
    let waited: Promise<unknown> | undefined;
    worker.listeners.get("activate")!({
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    });
    await waited;
    expect(worker.caches.delete).toHaveBeenCalledWith("pekulo-shell-v0");
    expect(worker.caches.delete).not.toHaveBeenCalledWith("pekulo-shell-v1");
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });

  test("AC-5 — a POST is never intercepted", () => {
    let responded = false;
    worker.listeners.get("fetch")!({
      request: { method: "POST", url: `${ORIGIN}/dashboard`, mode: "navigate" },
      respondWith: () => {
        responded = true;
      },
    });
    expect(responded).toBe(false);
  });

  test("cross-origin GETs are never intercepted", () => {
    let responded = false;
    worker.listeners.get("fetch")!({
      request: { method: "GET", url: "https://supabase.co/auth/v1/user", mode: "cors" },
      respondWith: () => {
        responded = true;
      },
    });
    expect(responded).toBe(false);
  });

  test("a non-offline route is not intercepted", () => {
    const event = navigate(`${ORIGIN}/dashboard/transactions`);
    worker.listeners.get("fetch")!(event);
    expect(event.responded()).toBeUndefined();
  });

  test("AC-1 — an offline route is served from the network and cached", async () => {
    worker.fetchMock.mockResolvedValue({
      ok: true,
      body: "SHELL",
      clone: () => ({ body: "SHELL" }),
    });
    const event = navigate(`${ORIGIN}/dashboard`);
    worker.listeners.get("fetch")!(event);
    await event.responded();
    expect(worker.cache.put).toHaveBeenCalled();
    expect(worker.store.get(`${ORIGIN}/dashboard`)).toBe("SHELL");
  });

  test("AC-1 — when the network fails the cached shell is returned", async () => {
    worker.fetchMock.mockResolvedValueOnce({
      ok: true,
      body: "SHELL",
      clone: () => ({ body: "SHELL" }),
    });
    const online = navigate(`${ORIGIN}/dashboard/portefeuille`);
    worker.listeners.get("fetch")!(online);
    await online.responded();

    worker.fetchMock.mockRejectedValue(new Error("offline"));
    const offline = navigate(`${ORIGIN}/dashboard/portefeuille`);
    worker.listeners.get("fetch")!(offline);
    await expect(offline.responded()).resolves.toBe("SHELL");
  });

  test("AC-1 — the Patrimoine tab is served offline from the /dashboard shell", async () => {
    // `?tab=patrimoine` is a primary in-app URL (cap-shell pushes it), and the
    // Cache API keys on the FULL url by default — so a user who had only ever
    // loaded /dashboard online got a network-error page offline the moment they
    // tapped Patrimoine.
    worker.fetchMock.mockResolvedValueOnce({
      ok: true,
      body: "SHELL",
      clone: () => ({ body: "SHELL" }),
    });
    const online = navigate(`${ORIGIN}/dashboard`);
    worker.listeners.get("fetch")!(online);
    await online.responded();

    worker.fetchMock.mockRejectedValue(new Error("offline"));
    const offline = navigate(`${ORIGIN}/dashboard?tab=patrimoine`);
    worker.listeners.get("fetch")!(offline);
    await expect(offline.responded()).resolves.toBe("SHELL");
  });

  test("a trailing slash is still an offline route", async () => {
    worker.fetchMock.mockResolvedValue({
      ok: true,
      body: "SHELL",
      clone: () => ({ body: "SHELL" }),
    });
    const event = navigate(`${ORIGIN}/dashboard/`);
    worker.listeners.get("fetch")!(event);
    expect(event.responded()).toBeDefined();
    await event.responded();
  });

  test("a cache.put failure still returns the network response", async () => {
    // Quota exceeded is the realistic trigger. Discarding a perfectly good
    // response because we could not store a copy of it is the wrong trade.
    worker.cache.put.mockRejectedValueOnce(new Error("QuotaExceededError"));
    worker.fetchMock.mockResolvedValue({
      ok: true,
      body: "SHELL",
      clone: () => ({ body: "SHELL" }),
    });
    const event = navigate(`${ORIGIN}/dashboard`);
    worker.listeners.get("fetch")!(event);
    await expect(event.responded()).resolves.toMatchObject({ body: "SHELL" });
  });

  test("AC-1 — an uncached route offline rejects rather than resolving empty", async () => {
    worker.fetchMock.mockRejectedValue(new Error("offline"));
    const event = navigate(`${ORIGIN}/dashboard/immobilier`);
    worker.listeners.get("fetch")!(event);
    await expect(event.responded()).rejects.toThrow("offline");
  });

  test("build assets are served cache-first", async () => {
    worker.fetchMock.mockResolvedValue({
      ok: true,
      body: "CHUNK",
      clone: () => ({ body: "CHUNK" }),
    });
    const url = `${ORIGIN}/_next/static/chunks/main.js`;
    let first: Promise<unknown> | undefined;
    worker.listeners.get("fetch")!({
      request: { method: "GET", url, mode: "no-cors" },
      respondWith: (p: Promise<unknown>) => {
        first = p;
      },
    });
    await first;
    expect(worker.fetchMock).toHaveBeenCalledTimes(1);

    let second: Promise<unknown> | undefined;
    worker.listeners.get("fetch")!({
      request: { method: "GET", url, mode: "no-cors" },
      respondWith: (p: Promise<unknown>) => {
        second = p;
      },
    });
    await expect(second).resolves.toBe("CHUNK");
    // Served from cache — no second network call.
    expect(worker.fetchMock).toHaveBeenCalledTimes(1);
  });
});
