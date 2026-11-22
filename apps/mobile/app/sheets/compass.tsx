// apps/mobile/app/sheets/compass.tsx
// Edit the compass objective and horizon (native iOS form sheet) — the web
// `compass-edit-form.tsx` equivalent, validated by `updateCompassInputSchema`
// (objective > 0, horizon 2–60 years).

import { MAX_HORIZON_YEARS, MIN_HORIZON_YEARS } from "@pekulo/validators";
import { useEffect, useState } from "react";

import { AmountField, FormSection, NumberField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { formatAmountInput, parseAmountInput } from "../../lib/forms";
import { useCompassMutation } from "../../lib/hooks/use-mobile-mutations";
import { useMobileCompassData } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function CompassSheet() {
  const { data } = useMobileCompassData();
  const updateCompass = useCompassMutation();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const { t } = useI18n();
  const [objectif, setObjectif] = useState("");
  const [horizon, setHorizon] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setObjectif(formatAmountInput(data.objectif));
    setHorizon(String(data.horizonYears));
    setHydrated(true);
  }, [data, hydrated]);

  return (
    <SheetScaffold
      title={t("settings.compass.title")}
      onPrimary={() => {
        void run(
          () =>
            updateCompass.mutateAsync({
              objectif: parseAmountInput(objectif),
              horizonYears: Number.parseInt(horizon, 10),
            }),
          t("settings.compass.saved"),
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection
        footer={t("settings.compass.footer", { min: MIN_HORIZON_YEARS, max: MAX_HORIZON_YEARS })}
      >
        <AmountField
          label={t("settings.compass.objective")}
          value={objectif}
          onChange={setObjectif}
          testID="compass-objectif"
        />
        <NumberField
          label={t("settings.compass.horizon")}
          value={horizon}
          onChange={setHorizon}
          suffix={t("settings.compass.years")}
          maxLength={2}
          testID="compass-horizon"
        />
      </FormSection>
    </SheetScaffold>
  );
}
