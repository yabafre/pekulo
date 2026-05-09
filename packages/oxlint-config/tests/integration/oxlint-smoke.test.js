// @ts-check
import { beforeAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
// Renamed from `.oxlintrc.json` to escape oxlint's walk-up auto-discovery —
// otherwise staging a fixture file would trip pekulo/* rules during a normal
// `bunx oxlint` from the repo root. Driver passes `--config` explicitly.
const configPath = join(fixturesDir, "fixture-oxlintrc.json");

/**
 * Run oxlint against a single fixture file via Bun's spawn (async, parallelisable).
 *
 * @param {string} relativeFile
 */
async function runOxlint(relativeFile) {
  const proc = Bun.spawn({
    cmd: [
      "bunx",
      "oxlint",
      "--config",
      configPath,
      "--format",
      "default",
      join(fixturesDir, relativeFile),
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

const cases = [
  {
    rule: "no-prisma-query-without-user-id",
    validPath: "prisma/valid.ts",
    invalidPath: "prisma/invalid.ts",
    invalidMessage: "missing 'where.userId'",
  },
  {
    rule: "no-tailwind-outside-ui",
    validPath: "tailwind/valid.tsx",
    invalidPath: "tailwind/invalid.tsx",
    invalidMessage: "Tailwind utility classes are forbidden",
  },
  {
    rule: "no-server-action-in-component",
    validPath: "server-action/valid.tsx",
    invalidPath: "server-action/invalid.tsx",
    invalidMessage: "Server action imported directly",
  },
  {
    rule: "no-cross-feature-action-import",
    validPath: "cross-feature/accounts/valid.ts",
    invalidPath: "cross-feature/accounts/invalid.ts",
    invalidMessage: "Cross-feature import",
  },
];

/** @type {Map<string, { exitCode: number; stdout: string; stderr: string }>} */
const results = new Map();

describe("oxlint smoke — @pekulo/oxlint-config plugin loaded via jsPlugins", () => {
  beforeAll(async () => {
    // Spawn all 8 oxlint invocations concurrently — independent fixture files.
    const paths = cases.flatMap((c) => [c.validPath, c.invalidPath]);
    const all = await Promise.all(paths.map((p) => runOxlint(p).then((r) => [p, r])));
    for (const [p, r] of /** @type {[string, any][]} */ (all)) {
      results.set(p, r);
    }
  });

  for (const c of cases) {
    test(`${c.rule}: valid fixture exits 0`, () => {
      const r = results.get(c.validPath);
      if (!r) throw new Error(`missing result for ${c.validPath}`);
      const combined = r.stdout + r.stderr;
      expect(combined).not.toContain(c.rule);
      expect(r.exitCode).toBe(0);
    });

    test(`${c.rule}: invalid fixture exits 1 with rule message`, () => {
      const r = results.get(c.invalidPath);
      if (!r) throw new Error(`missing result for ${c.invalidPath}`);
      const combined = r.stdout + r.stderr;
      expect(combined).toContain(c.invalidMessage);
      expect(r.exitCode).toBe(1);
    });
  }
});
