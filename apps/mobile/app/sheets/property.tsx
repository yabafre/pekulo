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
import { useI18n } from "../../lib/i18n";
import { useOptions } from "../../lib/options";

export default function PropertySheet() {
  const options = useOptions();
  const { t } = useI18n();
  const { createProperty } = useRealEstateMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const [label, setLabel] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("residence-principale");
  const [valuation, setValuation] = useState("");
  const [valuedOn, setValuedOn] = useState(() => new Date());

  return (
    <SheetScaffold
      title={t("realestate.property.title")}
      primaryLabel={t("common.actions.add")}
      onPrimary={() => {
        void run(
          () =>
            createProperty.mutateAsync({
              label: label.trim(),
              propertyType,
              currentValuation: parseAmountInput(valuation),
              lastValuedOn: toUtcDay(valuedOn),
            }),
          t("realestate.property.added"),
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection>
        <TextField
          label={t("realestate.property.name")}
          value={label}
          onChange={setLabel}
          placeholder={t("realestate.property.namePlaceholder")}
          maxLength={120}
          testID="prop-label"
        />
        <SelectField
          label={t("common.fields.type")}
          value={propertyType}
          options={options.propertyTypes}
          onChange={setPropertyType}
          testID="prop-type"
        />
      </FormSection>
      <FormSection footer={t("realestate.property.footer")}>
        <AmountField
          label={t("realestate.property.valuation")}
          value={valuation}
          onChange={setValuation}
          testID="prop-valuation"
        />
        <DateField
          label={t("realestate.property.valuedOn")}
          value={valuedOn}
          onChange={setValuedOn}
          maximumDate={new Date()}
          testID="prop-valued-on"
        />
      </FormSection>
    </SheetScaffold>
  );
}
