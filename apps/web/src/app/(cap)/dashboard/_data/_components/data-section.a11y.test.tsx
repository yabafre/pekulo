import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ExportDataRow } from "./export-data-row";
import { renderWithTamagui } from "../../../../../../test/setup";

// Story 11-1, AC-7 (verbatim from story 11-1-data-export:21):
//   Given the Paramètres page, When it renders, Then a « Vos données » section
//   appears after the « Intelligence artificielle » section and before the
//   compass settings, holding one row labelled « Exporter mes données » with
//   the sub-label « JSON complet · conforme RGPD » and a download control — in
//   both `fr` and `en`. When that section is scanned for accessibility, Then it
//   reports zero violations and the download control exposes an accessible name.
//
// PekuloSettingRow renders Tamagui primitives, so it must be mounted through
// the TamaguiTestProvider wrapper — a bare @testing-library/react render throws
// on the missing Tamagui context. Same helper and same relative depth as the
// sibling _appearance/_components/appearance-section.a11y.test.tsx.
describe("ExportDataRow a11y (story 11-1)", () => {
  it("has no axe violations", async () => {
    const { container } = renderWithTamagui(
      <ExportDataRow
        label="Exporter mes données"
        sub="JSON complet · conforme RGPD"
        action="Exporter"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes the download link with an accessible name", () => {
    const { getByRole } = renderWithTamagui(
      <ExportDataRow
        label="Exporter mes données"
        sub="JSON complet · conforme RGPD"
        action="Exporter"
      />,
    );
    const link = getByRole("link", { name: "Exporter" });
    expect(link.getAttribute("href")).toBe("/v1/export");
    expect(link.hasAttribute("download")).toBe(true);
  });
});
