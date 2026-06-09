// apps/web/src/app/(cap)/dashboard/_components/dashboard-edit-context.test.tsx
// Story 7-2 (D1) — the shell↔CapView editing flag. The "Personnaliser" button
// (in the shell) and the widget grid + edit layer (under CapView) share this
// one boolean via context. Outside the provider it degrades to a safe no-op.
import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../test/setup";
import { DashboardEditProvider, useDashboardEdit } from "./dashboard-edit-context";

function Probe() {
  const { editing, setEditing } = useDashboardEdit();
  return (
    <button type="button" onClick={() => setEditing((v) => !v)}>
      {editing ? "editing-on" : "editing-off"}
    </button>
  );
}

describe("DashboardEditProvider / useDashboardEdit", () => {
  it("toggles editing on button press", () => {
    const { getByRole } = renderWithTamagui(
      <DashboardEditProvider>
        <Probe />
      </DashboardEditProvider>,
    );
    const btn = getByRole("button");
    expect(btn.textContent).toBe("editing-off");
    fireEvent.click(btn);
    expect(btn.textContent).toBe("editing-on");
    fireEvent.click(btn);
    expect(btn.textContent).toBe("editing-off");
  });

  it("returns a safe no-op default when rendered outside the provider", () => {
    const { getByRole } = renderWithTamagui(<Probe />);
    const btn = getByRole("button");
    expect(btn.textContent).toBe("editing-off");
    fireEvent.click(btn); // no provider → no-op, must not throw
    expect(btn.textContent).toBe("editing-off");
  });
});
