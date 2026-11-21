// apps/mobile/app/sheets/property.tsx
// Add a property (native iOS form sheet) — the web `property-create-form.tsx`
// equivalent calling `realestate.createProperty`.

import type { PropertyType } from "@pekulo/types";
import { useState } from "react";

import {
  AmountField,
  DateField,
  FormSection,
  SelectField,
  TextField,
} from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { parseAmountInput, toUtcDay } from "../../lib/forms";
import { useRealEstateMutations } from "../../lib/hooks/use-mobile-mutations";
import { PROPERTY_TYPE_OPTIONS } from "../../lib/options";

export default function PropertySheet() {
  const { createProperty } = useRealEstateMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const [label, setLabel] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("residence-principale");
  const [valuation, setValuation] = useState("");
  const [valuedOn, setValuedOn] = useState(() => new Date());

  return (
    <SheetScaffold
      title="Nouveau bien"
      primaryLabel="Ajouter"
      onPrimary={() => {
        void run(
          () =>
            createProperty.mutateAsync({
              label: label.trim(),
              propertyType,
              currentValuation: parseAmountInput(valuation),
              lastValuedOn: toUtcDay(valuedOn),
            }),
          "Bien ajouté",
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection>
        <TextField
          label="Nom du bien"
          value={label}
          onChange={setLabel}
          placeholder="Appartement Lyon 7e"
          maxLength={120}
          testID="prop-label"
        />
        <SelectField
          label="Type"
          value={propertyType}
          options={PROPERTY_TYPE_OPTIONS}
          onChange={setPropertyType}
          testID="prop-type"
        />
      </FormSection>
      <FormSection footer="Vous pourrez ajouter le crédit et le loyer ensuite.">
        <AmountField
          label="Valeur estimée"
          value={valuation}
          onChange={setValuation}
          testID="prop-valuation"
        />
        <DateField
          label="Estimée le"
          value={valuedOn}
          onChange={setValuedOn}
          maximumDate={new Date()}
          testID="prop-valued-on"
        />
      </FormSection>
    </SheetScaffold>
  );
}
