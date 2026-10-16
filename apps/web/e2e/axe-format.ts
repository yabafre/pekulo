// apps/web/e2e/axe-format.ts
// Filters axe-core results to `serious` and `critical` impacts and formats
// every offending node with its rule ID, CSS selector target, and HTML
// snippet (story 11-4, AC-1).

export interface AxeNodeLike {
  target: Array<string | string[]>;
  html: string;
  failureSummary?: string;
}

export interface AxeViolationLike {
  id: string;
  impact?: string | null;
  help: string;
  nodes: AxeNodeLike[];
}

export function filterSeriousAndCritical(violations: AxeViolationLike[]): AxeViolationLike[] {
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

export function formatAxeViolations(
  route: string,
  profile: string,
  violations: AxeViolationLike[],
): string {
  const blocking = filterSeriousAndCritical(violations);
  if (blocking.length === 0) return "";
  const lines: string[] = [
    `[axe-a11y] ${blocking.length} serious/critical violation(s) on ${route} (${profile}):`,
  ];
  for (const v of blocking) {
    for (const node of v.nodes) {
      const selector = node.target.map((t) => (Array.isArray(t) ? t.join(" ") : t)).join(" > ");
      lines.push(
        `  - rule: ${v.id} (${v.impact}) — ${v.help}\n    selector: ${selector}\n    html: ${node.html}`,
      );
    }
  }
  return lines.join("\n");
}
