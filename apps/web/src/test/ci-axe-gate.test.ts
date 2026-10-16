// apps/web/src/test/ci-axe-gate.test.ts
// Verifies that `.github/workflows/pr.yml` defines the `axe-a11y` hard-gate
// job and `.github/workflows/deploy.yml` stays gated on the `pr` workflow's
// `success` conclusion (story 11-4, AC-5).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");

describe("CI axe-a11y hard gate (AC-5)", () => {
  // AC-5 (verbatim from story 11-4-axe-and-wcag-gates, AC-5):
  //   Given the pull-request CI workflow, When the axe-a11y job fails, Then
  //   the workflow concludes with failure and the production deployment
  //   workflow does not fire (hard gate).
  it("defines the non-optional axe-a11y job in pr.yml running test:e2e:axe", () => {
    const prYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr.yml"), "utf8");
    expect(prYml).toMatch(/^ {2}axe-a11y:\s*$/m);
    expect(prYml).toContain("apps/web/e2e/stack/docker-compose.yml");
    // Scope assertions to the axe-a11y job body: from its 2-space header to the
    // next 2-space job header (not to EOF, which previously made every later
    // job's keys leak into the block) and demand the exact key nowhere inside.
    const afterAxeHeader = prYml.split(/^ {2}axe-a11y:\s*$/m)[1] ?? "";
    const axeBlock = afterAxeHeader.split(/^ {2}[a-z0-9-]+:\s*$/m)[0] ?? "";
    expect(axeBlock).not.toBe("");
    expect(axeBlock).toContain("bun --filter=@pekulo/web run test:e2e:axe");
    expect(axeBlock).not.toMatch(/continue-on-error/);
  });

  it("keeps deploy.yml gated on workflow_run(pr).conclusion == 'success'", () => {
    const deployYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/deploy.yml"), "utf8");
    expect(deployYml).toContain('workflows: ["pr"]');
    expect(deployYml).toContain("github.event.workflow_run.conclusion == 'success'");
  });
});
