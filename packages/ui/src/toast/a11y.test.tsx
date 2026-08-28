import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe, fireEvent } from "../../test/setup.tsx";
import { PekuloToast, PekuloToastViewport, ToastProvider, useToast } from ".";

describe("PekuloToast a11y", () => {
  it("has role=status + no serious violations", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloToast entry={{ id: 3, title: "ok", intent: "info", durationMs: 4000 }} />,
    );
    expect(getByRole("status")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});

// Added at aped-review (story 10-1) — see snapshot.test.tsx for why these were
// uncovered. The viewport is scanned with a real queued toast: an empty
// viewport renders an empty <View>, and axe over an empty subtree is a
// vacuous pass.
describe("PekuloToastViewport a11y", () => {
  it("has no serious/critical violations with a queued toast", async () => {
    function Trigger() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.danger("Erreur", "Import échoué")}>
          go
        </button>
      );
    }
    const { container, getByText, getAllByRole } = renderWithTamagui(
      <ToastProvider>
        <Trigger />
        <PekuloToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(getByText("go"));
    expect(getAllByRole("status")).toHaveLength(1);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
