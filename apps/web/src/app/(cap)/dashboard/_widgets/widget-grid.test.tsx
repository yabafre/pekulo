// apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.test.tsx
// Story 7-2 (AC-1, AC-3, AC-7) — the read-view grid. Renders the VISIBLE
// widgets in order; a hidden widget is absent. On the default (non-edit) path
// it must NOT mount the dnd edit layer (AC-3: dnd-kit stays out of the default
// bundle) — proven here by the absence of the edit-mode surface.
import { describe, expect, it } from "vitest";
import { Text } from "@pekulo/ui/client";
import type { ResolvedWidget } from "./layout";
import { renderWithTamagui } from "../../../../../test/setup";
import { WidgetGrid } from "./widget-grid";

const WIDGETS = [
  {
    id: "hero",
    label: "Patrimoine",
    visible: true,
    order: 0,
    colSpan: 7,
    render: () => <Text>W-hero</Text>,
  },
  {
    id: "compass",
    label: "Cap",
    visible: true,
    order: 1,
    colSpan: 5,
    render: () => <Text>W-compass</Text>,
  },
  {
    id: "composition",
    label: "Composition",
    visible: false,
    order: 2,
    colSpan: 5,
    render: () => <Text>W-composition</Text>,
  },
] as unknown as ResolvedWidget[];

describe("WidgetGrid (read view)", () => {
  it("renders the visible widgets in order", () => {
    const { container, getAllByText } = renderWithTamagui(
      <WidgetGrid widgets={WIDGETS} editing={false} />,
    );
    expect(getAllByText("W-hero").length).toBeGreaterThan(0);
    expect(getAllByText("W-compass").length).toBeGreaterThan(0);
    const text = container.textContent ?? "";
    expect(text.indexOf("W-hero")).toBeLessThan(text.indexOf("W-compass"));
  });

  it("omits a hidden widget", () => {
    const { queryByText } = renderWithTamagui(<WidgetGrid widgets={WIDGETS} editing={false} />);
    expect(queryByText("W-composition")).toBeNull();
  });

  it("does NOT mount the dnd edit layer on the default (non-edit) path (AC-3)", () => {
    const { queryByLabelText } = renderWithTamagui(
      <WidgetGrid widgets={WIDGETS} editing={false} />,
    );
    expect(queryByLabelText("Personnaliser le tableau de bord")).toBeNull();
  });
});
