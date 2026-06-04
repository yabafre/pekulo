// apps/web/src/app/(cap)/dashboard/_widgets/layout.test.ts
// Story 7-2 (AC-1, AC-6) — the layout reconciliation. resolveLayout starts from
// the registry defaults, overlays the saved layout, DROPS unknown ids and
// APPENDS registry ids missing from the saved layout at the end, then sorts by
// order. A null/absent saved layout renders the FR-41-ordered default.
import { describe, expect, it } from "vitest";
import type { DashboardLayout, DashboardWidgetId } from "@pekulo/validators";
import { defaultLayout, resolveLayout } from "./layout";

const ids = (layout: { id: DashboardWidgetId }[]) => layout.map((w) => w.id);

describe("resolveLayout", () => {
  it("AC-1 — the default (null) layout orders the FR-41 trio first", () => {
    const resolved = resolveLayout(null);
    expect(ids(resolved).slice(0, 3)).toEqual(["hero", "compass", "nextMilestone"]);
    expect(resolved).toHaveLength(8);
  });

  it("AC-6 — drops unknown widget ids from a stored layout", () => {
    const saved = {
      widgets: [
        { id: "hero", visible: true, order: 0 },
        { id: "bogus", visible: true, order: 1 },
      ],
    } as unknown as DashboardLayout;
    const resolved = resolveLayout(saved);
    expect(ids(resolved)).not.toContain("bogus");
    expect(resolved).toHaveLength(8); // every registry widget, no orphan
  });

  it("AC-6 — appends registry ids missing from the saved layout at the end", () => {
    const saved: DashboardLayout = {
      widgets: [{ id: "composition", visible: true, order: 0 }],
    };
    const resolved = resolveLayout(saved);
    expect(ids(resolved)[0]).toBe("composition"); // the saved one keeps order 0
    expect(resolved).toHaveLength(8); // the other 7 are backfilled after it
    expect(ids(resolved)).toContain("hero");
  });

  it("AC-6 — honours stored visibility over the registry default", () => {
    const saved: DashboardLayout = {
      widgets: [{ id: "composition", visible: false, order: 0 }],
    };
    const resolved = resolveLayout(saved);
    expect(resolved.find((w) => w.id === "composition")?.visible).toBe(false);
  });

  it("defaultLayout() lists every registry widget at its default order", () => {
    const def = defaultLayout();
    expect(def.widgets).toHaveLength(8);
    expect(def.widgets.map((w) => w.id).slice(0, 3)).toEqual(["hero", "compass", "nextMilestone"]);
  });
});
