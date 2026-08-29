import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Section } from "@pekulo/ui";
import { ExportDataRow } from "./export-data-row";
import { DataSection } from "./data-section";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";
import en from "../../../../../../messages/en.json";

// Story 11-1, AC-7. PekuloSettingRow renders Tamagui primitives, so it must be
// mounted through the TamaguiTestProvider wrapper — a bare
// @testing-library/react render throws on the missing Tamagui context. Same
// helper and same relative depth as the sibling
// _appearance/_components/appearance-section.a11y.test.tsx.
//
// Renamed from data-section.a11y.test.tsx in aped-review of 11-1: the file
// promised coverage of the section and only ever rendered the row, so the
// <Section> landmark AC-7 names was never scanned. It now covers both, plus the
// i18n wiring — previously nothing executable proved that data-section.tsx read
// the keys T12 added, in either locale.
describe("ExportDataRow a11y (story 11-1)", () => {
  it("has no axe violations", async () => {
    const { container } = renderWithTamagui(
      <ExportDataRow
        label="Exporter mes données"
        sub="JSON complet · conforme RGPD"
        action="Exporter"
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations inside the « Vos données » landmark", async () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel="Vos données" title="Vos données">
        <ExportDataRow
          label="Exporter mes données"
          sub="JSON complet · conforme RGPD"
          action="Exporter"
        />
      </Section>,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("exposes the download link under the full row label, not the bare verb", async () => {
    const { getByRole } = renderWithTamagui(
      <ExportDataRow
        label="Exporter mes données"
        sub="JSON complet · conforme RGPD"
        action="Exporter"
      />,
    );
    // « Exporter » alone is meaningless in a links rotor, and story 11-2 adds an
    // identically shaped « Supprimer » row right below. The accessible name
    // still contains the visible text, so WCAG 2.5.3 holds.
    const link = getByRole("link", { name: "Exporter mes données" });
    expect(link.getAttribute("href")).toBe("/v1/export");
    expect(link.hasAttribute("download")).toBe(true);
  });
});

describe("DataSection copy (story 11-1, AC-7)", () => {
  it("renders the fr catalogue copy the section actually reads", async () => {
    // DataSection is an async RSC: await it, then mount what it returned. This
    // is what proves data-section.tsx points at real catalogue keys — a typo
    // would render the raw key path here, and apps/web declares no
    // IntlMessages type, so tsc cannot catch it either.
    const { getByText, getByRole } = renderWithTamagui(await DataSection());
    expect(getByRole("region", { name: fr.settings.data.title })).toBeInTheDocument();
    expect(getByText(fr.settings.data.exportLabel)).toBeInTheDocument();
    expect(getByText(fr.settings.data.exportSub)).toBeInTheDocument();
    expect(getByText(fr.settings.data.exportAction)).toBeInTheDocument();
  });

  it("ships the same settings.data keys in fr and en", () => {
    // The setup mock backs getTranslations with the FR catalogue only, so the
    // en rendering cannot be asserted directly. Key parity is what actually
    // guards the failure mode: a key present in one catalogue and missing from
    // the other is a runtime next-intl error for half the users.
    const frKeys = Object.keys(fr.settings.data).sort();
    const enKeys = Object.keys(en.settings.data).sort();
    expect(enKeys).toEqual(frKeys);
    for (const key of frKeys) {
      const value = (en.settings.data as Record<string, string>)[key];
      expect(value, `en.settings.data.${key} is empty`).toBeTruthy();
    }
  });
});
