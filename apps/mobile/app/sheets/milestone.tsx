// apps/mobile/app/sheets/milestone.tsx
// Add a milestone (native iOS form sheet). Same fields and limits as the web
// `add-milestone-form.tsx`: target capital, target year, optional label, and
// the per-user cap enforced client-side before calling `milestones.add`.

import { MILESTONES_PER_USER_CAP } from "@pekulo/validators";
import { useState } from "react";

import { AmountField, FormSection, NumberField, TextField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { parseAmountInput } from "../../lib/forms";
import { useMilestoneMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileCapData } from "../../lib/hooks/use-mobile-queries";

export default function MilestoneSheet() {
  const { data } = useMobileCapData();
  const { add } = useMilestoneMutations();
  const { run, error, setError, pending } = useMutationRunner({ dismiss: true });
  const [capital, setCapital] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() + 5));
  const [label, setLabel] = useState("");

  function save() {
    if ((data?.milestones.length ?? 0) >= MILESTONES_PER_USER_CAP) {
      setError(`Vous avez atteint la limite de ${MILESTONES_PER_USER_CAP} paliers.`);
      return;
    }
    const trimmed = label.trim();
    void run(
      () =>
        add.mutateAsync({
          targetCapital: parseAmountInput(capital),
          targetYear: Number.parseInt(year, 10),
          ...(trimmed ? { label: trimmed } : {}),
        }),
      "Palier ajouté",
    );
  }

  return (
    <SheetScaffold
      title="Nouveau palier"
      primaryLabel="Ajouter"
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection footer="Un palier jalonne votre trajectoire vers le cap.">
        <AmountField
          label="Capital visé"
          value={capital}
          onChange={setCapital}
          testID="ms-capital"
        />
        <NumberField label="Année" value={year} onChange={setYear} maxLength={4} testID="ms-year" />
        <TextField
          label="Nom (facultatif)"
          value={label}
          onChange={setLabel}
          placeholder="Palier 250 k€"
          maxLength={120}
          testID="ms-label"
        />
      </FormSection>
    </SheetScaffold>
  );
}
