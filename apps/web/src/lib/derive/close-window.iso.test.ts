// Mirror-drift guard for the close-window pure derive (story 5-5).
//
// apps/web/src/lib/derive/close-window.ts and
// apps/api/src/common/derive/close-window.ts are intentional byte-for-byte
// duplicates (no shared @pekulo/derive package yet — see the header comment
// in either file). The only tolerated difference is the very first header
// line, which spells out each side's own mirror path. This test reads both
// files from the repo root and asserts equality after stripping that first
// line, so the next silent divergence breaks CI instead of code review.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Walk up from this file until the monorepo root (the dir with turbo.json). */
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "turbo.json"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("repo root (turbo.json) not found walking up from close-window.iso.test.ts");
    }
    dir = parent;
  }
  return dir;
}

/** Drop the first line (the per-side path header comment) and normalise EOL. */
function bodyWithoutHeader(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  return lines.slice(1).join("\n");
}

describe("close-window mirror (web ↔ api)", () => {
  const root = findRepoRoot();
  const webPath = join(root, "apps/web/src/lib/derive/close-window.ts");
  const apiPath = join(root, "apps/api/src/common/derive/close-window.ts");

  it("both mirror files exist", () => {
    expect(existsSync(webPath), `missing ${webPath}`).toBe(true);
    expect(existsSync(apiPath), `missing ${apiPath}`).toBe(true);
  });

  it("is byte-for-byte identical aside from the first header line", () => {
    const web = readFileSync(webPath, "utf8");
    const api = readFileSync(apiPath, "utf8");

    // The header line itself must differ (each side names its own path); if
    // they ever match, the path comment was copy-pasted wrong.
    const webHeader = web.replace(/\r\n/g, "\n").split("\n")[0];
    const apiHeader = api.replace(/\r\n/g, "\n").split("\n")[0];
    expect(webHeader).not.toEqual(apiHeader);

    expect(bodyWithoutHeader(web)).toEqual(bodyWithoutHeader(api));
  });
});
