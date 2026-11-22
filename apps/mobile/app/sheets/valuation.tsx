// apps/mobile/app/sheets/valuation.tsx
// Record a new valuation for a property (native iOS form sheet) — the web
// `valuation-update-form.tsx` equivalent. Params: `id` (property).

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AmountField, DateField, FormSection } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { formatAmountInput, parseAmountInput, toUtcDay } from "../../lib/forms";
import { useRealEstateMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileRealEstateData } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function ValuationSheet() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { data } = useMobileRealEstateData();
  const { recordValuation } = useRealEstateMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const { t } = useI18n();
  const index = data?.propertyIds.indexOf(id) ?? -1;
  const property = index >= 0 ? data?.properties[index] : undefined;

  const [amount, setAmount] = useState("");
  const [valuedOn, setValuedOn] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!property || hydrated) return;
    setHydrated(true);
    if (amount !== "") return;
    setAmount(formatAmountInput(property.valuationEur));
  }, [property, hydrated, amount]);

  return (
    <SheetScaffold
      title={property ? property.label : t("realestate.valuation.title")}
      onPrimary={() => {
        void run(
          () =>
            recordValuation.mutateAsync({
              propertyId: id,
              amount: parseAmountInput(amount),
              valuedOn: toUtcDay(valuedOn),
            }),
          t("realestate.valuation.saved"),
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection footer={t("realestate.valuation.footer")}>
        <AmountField
          label={t("realestate.valuation.amount")}
          value={amount}
          onChange={setAmount}
          testID="val-amount"
        />
        <DateField
          label={t("realestate.property.valuedOn")}
          value={valuedOn}
          onChange={setValuedOn}
          maximumDate={new Date()}
          testID="val-date"
        />
      </FormSection>
    </SheetScaffold>
  );
}
