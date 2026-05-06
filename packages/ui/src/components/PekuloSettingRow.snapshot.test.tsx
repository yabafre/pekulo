import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSettingRow } from "./PekuloSettingRow";

describe("PekuloSettingRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloSettingRow label="Email" value="alex@example.fr" />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders destructive", () => {
    const { container } = renderWithTamagui(
      <PekuloSettingRow label="Supprimer le compte" sub="Action irréversible" destructive />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
