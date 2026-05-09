// @ts-check
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
const configPath = join(fixturesDir, "fixture-oxlintrc.json");

/**
 * Run oxlint against a single fixture file.
 * @param {string} relativeFile
 */
function runOxlint(relativeFile) {
  const result = spawnSync(
    "bunx",
    ["oxlint", "--config", configPath, "--format", "default", join(fixturesDir, relativeFile)],
    { encoding: "utf8" },
  );
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
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

describe("oxlint smoke — @pekulo/oxlint-config plugin loaded via jsPlugins", () => {
  for (const c of cases) {
    test(`${c.rule}: valid fixture exits 0`, () => {
      const r = runOxlint(c.validPath);
      const combined = r.stdout + r.stderr;
      expect(combined).not.toContain(c.rule);
      expect(r.exitCode).toBe(0);
    });

    test(`${c.rule}: invalid fixture exits non-zero with rule message`, () => {
      const r = runOxlint(c.invalidPath);
      const combined = r.stdout + r.stderr;
      expect(combined).toContain(c.invalidMessage);
      expect(r.exitCode).not.toBe(0);
    });
  }
});
