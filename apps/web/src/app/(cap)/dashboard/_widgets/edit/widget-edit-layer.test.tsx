// apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.test.tsx
// Story 7-2 (AC-4, AC-5) + resize extension — the grid edit mode. The pure
// helpers (snapSpan clamp/round, serializeLayout with sizes) are unit-tested;
// the toggle / reset / done interactions go through the DOM. The pointer-drag
// resize itself is verified live (jsdom reports zero element sizes, so the snap
// unit collapses — covered by snapSpan's unit-only guard test instead).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";
import { WidgetEditLayer, serializeLayout, snapSpan } from "./widget-edit-layer";

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
  {
    id: "hero",
    label: "Patrimoine",
    visible: true,
    order: 0,
    colSpan: 7,
    rowSpan: 2,
    render: () => null,
  },
  {
    id: "compass",
    label: "Cap",
    visible: true,
    order: 1,
    colSpan: 5,
    rowSpan: 2,
    render: () => null,
  },
  {
    id: "composition",
    label: "Composition",
    visible: true,
    order: 2,
    colSpan: 5,
    rowSpan: 1,
    render: () => null,
  },
] as unknown as Parameters<typeof WidgetEditLayer>[0]["widgets"];

beforeEach(() => {
  save.mockReset();
  reset.mockReset();
  setEditing.mockReset();
});

describe("snapSpan (pure)", () => {
  it("adds the rounded number of units the pointer travelled, clamped", () => {
    expect(snapSpan(5, 100, 100, 1, 12)).toBe(6); // +1 unit
    expect(snapSpan(5, 240, 100, 1, 12)).toBe(7); // +2.4 → +2
    expect(snapSpan(5, -1000, 100, 1, 12)).toBe(1); // clamp to min
    expect(snapSpan(7, 1000, 100, 1, 12)).toBe(12); // clamp to max
  });

  it("leaves the span unchanged when the unit is zero (jsdom / unmeasured grid)", () => {
    expect(snapSpan(5, 999, 0, 1, 12)).toBe(5);
  });
});

describe("serializeLayout (pure)", () => {
  it("serializes order + visibility + spans into 0-based records", () => {
    expect(
      serializeLayout([
        { id: "compass", visible: true, colSpan: 12, rowSpan: 1 },
        { id: "hero", visible: false, colSpan: 4, rowSpan: 2 },
      ]),
    ).toEqual({
      widgets: [
        { id: "compass", visible: true, order: 0, colSpan: 12, rowSpan: 1 },
        { id: "hero", visible: false, order: 1, colSpan: 4, rowSpan: 2 },
      ],
    });
  });
});

describe("WidgetEditLayer", () => {
  it("renders one editable cell per widget", () => {
    const { getAllByRole } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    expect(getAllByRole("listitem")).toHaveLength(3);
  });

  it("exposes a resize handle per widget (AC: resize)", () => {
    const { getByLabelText } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    expect(getByLabelText(/Redimensionner Composition/)).toBeTruthy();
  });

  it("toggling a widget off saves it with visible:false (AC-5)", () => {
    const { getByLabelText } = renderWithTamagui(<WidgetEditLayer widgets={WIDGETS} />);
    fireEvent.click(getByLabelText("Afficher Composition"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].widgets).toContainEqual(
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
