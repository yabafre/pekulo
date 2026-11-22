// apps/mobile/app/sheets/rental.tsx
// Add or edit the rental income of a property (native iOS form sheet) — the
// web `rental-form.tsx` (attach / update modes). Params: `id` (property).

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AmountField, FormSection, SwitchField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { ScreenLoadingSkeleton } from "../../components/screen-states";
import { useAuth } from "../../lib/auth/auth-context";
import { formatAmountInput, parseAmountInput } from "../../lib/forms";
import { useRealEstateMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobilePropertyDetail } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function RentalSheet() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { isAuthenticated } = useAuth();
  const { data: detail, isLoading } = useMobilePropertyDetail(id);
  const { attachRental, updateRental } = useRealEstateMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const { t } = useI18n();
  const existing = detail?.rental ?? null;

  const [rent, setRent] = useState("");
  const [charges, setCharges] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!existing || hydrated) return;
    setRent(formatAmountInput(existing.monthlyRent));
    setCharges(formatAmountInput(existing.monthlyCharges));
    setFurnished(existing.furnished);
    setHydrated(true);
  }, [existing, hydrated]);

  function save() {
    const fields = {
      propertyId: id,
      monthlyRent: parseAmountInput(rent),
      monthlyCharges: charges.trim() === "" ? 0 : parseAmountInput(charges),
      furnished,
    };
    void run(
      () => (existing ? updateRental.mutateAsync(fields) : attachRental.mutateAsync(fields)),
      existing ? t("realestate.rental.updated") : t("realestate.rental.added"),
    );
  }

  // In preview mode nothing loads; keep the action so the sign-in prompt shows.
  const ready = Boolean(detail) || !isAuthenticated;

  return (
    <SheetScaffold
      title={existing ? t("realestate.rental.titleEdit") : t("realestate.rental.titleAdd")}
      primaryLabel={existing ? t("common.actions.save") : t("common.actions.add")}
      onPrimary={ready ? save : undefined}
      primaryDisabled={pending}
      error={error}
    >
      {!ready && isLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : (
        <FormSection footer={t("realestate.rental.footer")}>
          <AmountField
            label={t("realestate.rental.rent")}
            value={rent}
            onChange={setRent}
            testID="rent-amount"
          />
          <AmountField
            label={t("realestate.rental.charges")}
            value={charges}
            onChange={setCharges}
            testID="rent-charges"
          />
          <SwitchField
            label={t("realestate.rental.furnished")}
            value={furnished}
            onChange={setFurnished}
            testID="rent-furnished"
          />
        </FormSection>
      )}
    </SheetScaffold>
  );
}
