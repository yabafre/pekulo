// apps/web/src/test/axe-format.test.ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filterSeriousAndCritical, formatAxeViolations } from "../../e2e/axe-format";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..", "..");

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".auth") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith("axe-format.test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("axe-a11y violation formatter & web security boundary (AC-1, AC-4)", () => {
  // AC-1 (verbatim from story 11-4-axe-and-wcag-gates, AC-1):
  //   Given one of the seven priority routes (/dashboard,
  //   /dashboard/transactions, /dashboard/mensuel, /dashboard/portefeuille,
  //   /dashboard/immobilier, /dashboard/parametres, /login) rendered in
  //   Chromium across {dark desktop, light desktop, dark mobile} with a
  //   serious or critical axe violation (colour contrast included), When the
  //   axe-a11y CI gate runs, Then it fails naming the rule ID, CSS selector
  //   target, and HTML snippet of every offending node.
  it("formats every serious/critical violation with rule, selector, and html (AC-1)", () => {
    const report = formatAxeViolations("/dashboard", "dark-desktop", [
      {
        id: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast ratio thresholds",
        nodes: [
          {
            target: ["#low-contrast-probe"],
            html: '<span id="low-contrast-probe" style="color:#555;background:#444">Probe</span>',
          },
        ],
      },
      {
        id: "region",
        impact: "moderate",
        help: "All page content should be contained by landmarks",
        nodes: [{ target: ["div.orphan"], html: '<div class="orphan">x</div>' }],
      },
    ]);

    expect(
      filterSeriousAndCritical([{ id: "region", impact: "moderate", help: "h", nodes: [] }]),
    ).toEqual([]);
    expect(report).toContain("rule: color-contrast (serious)");
    expect(report).toContain("selector: #low-contrast-probe");
    expect(report).toContain(
      'html: <span id="low-contrast-probe" style="color:#555;background:#444">Probe</span>',
    );
    expect(report).not.toContain("region");
  });

  // AC-4 (verbatim from story 11-4-axe-and-wcag-gates, AC-4):
  //   Given a throwaway user created in the E2E setup against the local
  //   disposable Auth + Postgres stack, When it signs in through the real
  //   /login form, Then all six authenticated routes render without
  //   redirecting to /login, and no service-role key is read anywhere in the
  //   web application tier.
  it("never reads SUPABASE_SERVICE_ROLE_KEY anywhere under apps/web/src or apps/web/e2e (AC-4)", () => {
    const files = [
      ...walkSourceFiles(join(WEB_ROOT, "src")),
      ...walkSourceFiles(join(WEB_ROOT, "e2e")),
    ];
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"),
    );
    expect(
      offenders,
      `files reading SUPABASE_SERVICE_ROLE_KEY in apps/web: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
