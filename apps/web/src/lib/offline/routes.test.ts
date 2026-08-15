// The offline surface is declared twice — once for the Service Worker (which is
// a raw public/ file and cannot import) and once for the client bundle. This
// test is the joint that keeps the two copies honest: a route added to one and
// forgotten in the other means either a shell cached with no banner, or a banner
// promising read-only data on a screen that will not even load offline.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { OFFLINE_ROUTES, isOfflineRoute } from "./routes";

function routesDeclaredInWorker(): string[] {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const declaration = /const OFFLINE_ROUTES = \[([^\]]*)\]/.exec(source)?.[1];
  if (!declaration) throw new Error("public/sw.js no longer declares OFFLINE_ROUTES");
  return Array.from(declaration.matchAll(/"([^"]+)"/g))
    .map((match) => match[1])
    .filter((route): route is string => route !== undefined);
}

describe("offline routes (story 9-2)", () => {
  test("the client list matches the one baked into public/sw.js", () => {
    expect([...OFFLINE_ROUTES]).toEqual(routesDeclaredInWorker());
  });

  test("isOfflineRoute accepts exactly the three cap screens", () => {
    expect(isOfflineRoute("/dashboard")).toBe(true);
    expect(isOfflineRoute("/dashboard/portefeuille")).toBe(true);
    expect(isOfflineRoute("/dashboard/immobilier")).toBe(true);
  });

  test("a trailing slash still matches", () => {
    // Online, Next's `trailingSlash: false` redirects /dashboard/ away and the
    // problem is invisible. Offline that redirect never happens, so an exact
    // match means the worker declines to intercept and the navigation dies at
    // the network — with no cached shell and no banner.
    expect(isOfflineRoute("/dashboard/")).toBe(true);
    expect(isOfflineRoute("/dashboard/portefeuille/")).toBe(true);
    expect(isOfflineRoute("/dashboard/immobilier/")).toBe(true);
  });

  test("isOfflineRoute rejects screens the cache does not cover", () => {
    // These render fine online but have no snapshot and no cached shell — a
    // banner claiming "read-only data" there would be a lie.
    expect(isOfflineRoute("/login")).toBe(false);
    expect(isOfflineRoute("/dashboard/transactions")).toBe(false);
    expect(isOfflineRoute("/dashboard/mensuel")).toBe(false);
    expect(isOfflineRoute("/dashboard/parametres")).toBe(false);
    expect(isOfflineRoute("/")).toBe(false);
  });
});
