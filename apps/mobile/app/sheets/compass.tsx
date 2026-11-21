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

export default function CompassSheet() {
  const { data } = useMobileCompassData();
  const updateCompass = useCompassMutation();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
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
      title="Mon cap"
      onPrimary={() => {
        void run(
          () =>
            updateCompass.mutateAsync({
              objectif: parseAmountInput(objectif),
              horizonYears: Number.parseInt(horizon, 10),
            }),
          "Cap mis à jour",
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection
        footer={`Votre cap est le patrimoine visé à l’horizon choisi (${MIN_HORIZON_YEARS} à ${MAX_HORIZON_YEARS} ans).`}
      >
        <AmountField
          label="Objectif"
          value={objectif}
          onChange={setObjectif}
          testID="compass-objectif"
        />
        <NumberField
          label="Horizon"
          value={horizon}
          onChange={setHorizon}
          suffix="ans"
          maxLength={2}
          testID="compass-horizon"
        />
      </FormSection>
    </SheetScaffold>
  );
}
