// apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.test.tsx
// Story 7-2 (AC-4, AC-5) — the edit layer: drag-reorder + visibility toggles +
// reset. The dnd sensor→onDragEnd seam is verified visually (jsdom can't drive
// dnd-kit's coordinate sensors); here we cover the reorder/serialize logic
// purely and the toggle / reset / done interactions through the DOM.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";
import { WidgetEditLayer, reorderOrder, toLayout } from "./widget-edit-layer";

const save = vi.fn();
const reset = vi.fn();
const setEditing = vi.fn();

vi.mock("../../_hooks/use-dashboard-layout", () => ({
  useDashboardLayout: () => ({ widgets: null, isLoading: false, save, reset }),
}));
vi.mock("../../_components/dashboard-edit-context", () => ({
  useDashboardEdit: () => ({ editing: true, setEditing }),
}));

const WIDGETS = [
  { id: "hero", label: "Patrimoine", visible: true, order: 0, colSpan: 7, render: () => null },
  { id: "compass", label: "Cap", visible: true, order: 1, colSpan: 5, render: () => null },
  {
    id: "composition",
    label: "Composition",
    visible: true,
    order: 2,
    colSpan: 5,
    render: () => null,
  },
] as unknown as Parameters<typeof WidgetEditLayer>[0]["widgets"];

beforeEach(() => {
  save.mockReset();
  reset.mockReset();
  setEditing.mockReset();
});

describe("reorderOrder / toLayout (pure)", () => {
  it("reorderOrder moves the active id to the over id's slot", () => {
    expect(reorderOrder(["hero", "compass", "composition"], "hero", "composition")).toEqual([
      "compass",
      "composition",
      "hero",
    ]);
  });

  it("toLayout serializes order + visibility into 0-based widget records", () => {
    expect(toLayout(["compass", "hero"], { hero: false, compass: true })).toEqual({
      widgets: [
        { id: "compass", visible: true, order: 0 },
        { id: "hero", visible: false, order: 1 },
      ],
    });
  });
});

describe("WidgetEditLayer", () => {
  it("renders one sortable row per widget", () => {
    const { getAllByRole } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    expect(getAllByRole("listitem")).toHaveLength(3);
  });

  it("toggling a widget off saves it with visible:false (AC-5)", () => {
    const { getByLabelText } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    fireEvent.click(getByLabelText("Afficher Composition"));
    expect(save).toHaveBeenCalledTimes(1);
    const layout = save.mock.calls[0][0];
    expect(layout.widgets).toContainEqual(
      expect.objectContaining({ id: "composition", visible: false }),
    );
  });

  it("Réinitialiser restores the default layout (AC-5)", () => {
    const { getByLabelText } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    fireEvent.click(getByLabelText("Réinitialiser la disposition"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("Terminé exits edit mode", () => {
    const { getByLabelText } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    fireEvent.click(getByLabelText("Terminer"));
    expect(setEditing).toHaveBeenCalledWith(false);
  });
});
