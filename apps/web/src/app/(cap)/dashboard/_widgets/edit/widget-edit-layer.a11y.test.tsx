// apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.a11y.test.tsx
// Story 7-2 (AC-5) — zero critical/serious axe violations on the edit layer:
// every drag handle is labelled, every visibility switch is labelled, and the
// reorder list is reachable.
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";
import { WidgetEditLayer } from "./widget-edit-layer";

vi.mock("../../_hooks/use-dashboard-layout", () => ({
  useDashboardLayout: () => ({ widgets: null, isLoading: false, save: vi.fn(), reset: vi.fn() }),
}));
vi.mock("../../_components/dashboard-edit-context", () => ({
  useDashboardEdit: () => ({ editing: true, setEditing: vi.fn() }),
}));

const WIDGETS = [
  { id: "hero", label: "Patrimoine", visible: true, order: 0, colSpan: 7, render: () => null },
  { id: "compass", label: "Cap", visible: true, order: 1, colSpan: 5, render: () => null },
  {
    id: "composition",
    label: "Composition",
    visible: false,
    order: 2,
    colSpan: 5,
    render: () => null,
  },
] as unknown as Parameters<typeof WidgetEditLayer>[0]["widgets"];

describe("WidgetEditLayer a11y", () => {
  it("has no axe violations", async () => {
    const { container } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
