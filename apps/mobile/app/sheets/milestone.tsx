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
import { useAuth } from "../../lib/auth/auth-context";
import { useI18n } from "../../lib/i18n";

export default function MilestoneSheet() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { data } = useMobileCapData();
  const { add } = useMilestoneMutations();
  const { run, error, setError, pending } = useMutationRunner({ dismiss: true });
  const [capital, setCapital] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() + 5));
  const [label, setLabel] = useState("");

  function save() {
    if ((data?.milestones.length ?? 0) >= MILESTONES_PER_USER_CAP) {
      setError(t("cap.milestoneSheet.limitReached", { max: MILESTONES_PER_USER_CAP }));
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
      t("cap.milestoneSheet.added"),
    );
  }

  return (
    <SheetScaffold
      title={t("cap.milestoneSheet.title")}
      primaryLabel={t("common.actions.add")}
      onPrimary={save}
      // The 20-milestone cap is checked against loaded data: wait for it.
      primaryDisabled={pending || (isAuthenticated && !data)}
      error={error}
    >
      <FormSection footer={t("cap.milestoneSheet.footer")}>
        <AmountField
          label={t("cap.milestoneSheet.capital")}
          value={capital}
          onChange={setCapital}
          testID="ms-capital"
        />
        <NumberField
          label={t("cap.milestoneSheet.year")}
          value={year}
          onChange={setYear}
          maxLength={4}
          testID="ms-year"
        />
        <TextField
          label={t("cap.milestoneSheet.name")}
          value={label}
          onChange={setLabel}
          placeholder={t("cap.milestoneSheet.namePlaceholder")}
          maxLength={120}
          testID="ms-label"
        />
      </FormSection>
    </SheetScaffold>
  );
}
