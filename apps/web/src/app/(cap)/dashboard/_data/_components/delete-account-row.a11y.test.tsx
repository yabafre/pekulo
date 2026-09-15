import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Section } from "@pekulo/ui";
import { DeleteAccountRow } from "./delete-account-row";
import { ExportDataRow } from "./export-data-row";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";
import en from "../../../../../../messages/en.json";

// Story 11-2, AC-8 (verbatim from story 11-2-account-deletion:21):
//   […] the « Vos données » section holds a second row labelled « Supprimer
//   mon compte » with the sub-label « Cascade sur toutes les tables ·
//   irréversible », rendered in the destructive variant with a Trash2 +
//   « Supprimer » control — in both fr and en. […] When the section is scanned
//   for accessibility, Then it reports zero violations and both row controls
//   expose an accessible name.
// Mirrors export-data-row.a11y.test.tsx, plus the check that only exists once
// there are TWO rows: the export and delete controls must be distinguishable
// by accessible name, because their visible verbs (« Exporter » /
// « Supprimer ») are meaningless side by side in a rotor.
// The row mounts its dialog, and the dialog reaches the mutation hook; without
// this mock the real hook asks for a QueryClient the test never provides.
vi.mock("../_hooks/use-delete-account", () => ({
  useDeleteUserAccount: () => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/offline/cache-db", () => ({ purgeOfflineCache: vi.fn(async () => undefined) }));

const EMAIL = "alex@pekulo.local";

describe("DeleteAccountRow a11y (story 11-2)", () => {
  it("has no axe violations", async () => {
    const { container } = renderWithTamagui(
      <DeleteAccountRow
        label={fr.settings.data.deleteLabel}
        sub={fr.settings.data.deleteSub}
        action={fr.settings.data.deleteAction}
        email={EMAIL}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations in the two-row « Vos données » landmark", async () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel={fr.settings.data.title} title={fr.settings.data.title}>
        <ExportDataRow
          label={fr.settings.data.exportLabel}
          sub={fr.settings.data.exportSub}
          action={fr.settings.data.exportAction}
        />
        <DeleteAccountRow
          label={fr.settings.data.deleteLabel}
          sub={fr.settings.data.deleteSub}
          action={fr.settings.data.deleteAction}
          email={EMAIL}
        />
      </Section>,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("exposes the control under the full row label, not the bare verb", async () => {
    const { getByRole } = renderWithTamagui(
      <DeleteAccountRow
        label={fr.settings.data.deleteLabel}
        sub={fr.settings.data.deleteSub}
        action={fr.settings.data.deleteAction}
        email={EMAIL}
      />,
    );
    // Contains the visible text « Supprimer », so WCAG 2.5.3 holds.
    const control = getByRole("button", { name: fr.settings.data.deleteLabel });
    expect(control).toBeInTheDocument();
  });

  it("gives the export and delete controls distinct accessible names", async () => {
    const { getByRole } = renderWithTamagui(
      <Section ariaLabel={fr.settings.data.title} title={fr.settings.data.title}>
        <ExportDataRow
          label={fr.settings.data.exportLabel}
          sub={fr.settings.data.exportSub}
          action={fr.settings.data.exportAction}
        />
        <DeleteAccountRow
          label={fr.settings.data.deleteLabel}
          sub={fr.settings.data.deleteSub}
          action={fr.settings.data.deleteAction}
          email={EMAIL}
        />
      </Section>,
    );
    expect(getByRole("link", { name: fr.settings.data.exportLabel })).toBeInTheDocument();
    expect(getByRole("button", { name: fr.settings.data.deleteLabel })).toBeInTheDocument();
  });

  it("ships every settings.data key in both fr and en", () => {
    // The setup mock backs getTranslations with the FR catalogue only, so the
    // en rendering cannot be asserted directly. Key parity is the real guard:
    // a key present in one catalogue and missing from the other is a runtime
    // next-intl error for half the users.
    const frKeys = Object.keys(fr.settings.data).sort();
    const enKeys = Object.keys(en.settings.data).sort();
    expect(enKeys).toEqual(frKeys);
    for (const key of frKeys) {
      const value = (en.settings.data as Record<string, string>)[key];
      expect(value, `en.settings.data.${key} is empty`).toBeTruthy();
    }
  });
});
