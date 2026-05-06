import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloToast } from "./toast";

describe("PekuloToast snapshot", () => {
  it("renders success", () => {
    const { container } = renderWithTamagui(
      <PekuloToast
        entry={{
          id: 1,
          title: "Sauvegardé",
          description: "Cap mis à jour",
          intent: "success",
          durationMs: 4000,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders danger", () => {
    const { container } = renderWithTamagui(
      <PekuloToast entry={{ id: 2, title: "Erreur", intent: "danger", durationMs: 4000 }} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
