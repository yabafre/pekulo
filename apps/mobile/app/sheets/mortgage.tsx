// apps/mobile/app/sheets/mortgage.tsx
// Add or edit the mortgage of a property (native iOS form sheet) — the web
// `mortgage-form.tsx` (attach / update modes). The mode is decided from the
// loaded property, so the primary action only appears once it is known.
// The rate is typed in percent and sent as a 0..1 ratio. Params: `id`.

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AmountField, DateField, FormSection, NumberField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../components/screen-states";
import { useAuth } from "../../lib/auth/auth-context";
import {
  formatAmountInput,
  fromUtcDay,
  parseAmountInput,
  percentToRatio,
  toUtcDay,
} from "../../lib/forms";
import { useRealEstateMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobilePropertyDetail } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function MortgageSheet() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { isAuthenticated } = useAuth();
  const { data: detail, isLoading, isError, refetch } = useMobilePropertyDetail(id);
  const { attachMortgage, updateMortgage } = useRealEstateMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const { t } = useI18n();
  const existing = detail?.mortgage ?? null;

  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [payment, setPayment] = useState("");
  const [term, setTerm] = useState("");
  const [startDate, setStartDate] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!existing || hydrated) return;
    setPrincipal(formatAmountInput(existing.outstandingPrincipal));
    setRate(formatAmountInput(Math.round(existing.annualRate * 10000) / 100));
    setPayment(formatAmountInput(existing.monthlyPayment));
    setTerm(String(existing.termMonths));
    setStartDate(fromUtcDay(existing.startDate));
    setHydrated(true);
  }, [existing, hydrated]);

  function save() {
    const fields = {
      propertyId: id,
      outstandingPrincipal: parseAmountInput(principal),
      annualRate: percentToRatio(parseAmountInput(rate)),
      monthlyPayment: parseAmountInput(payment),
      termMonths: Number.parseInt(term, 10),
      startDate: toUtcDay(startDate),
    };
    void run(
      () => (existing ? updateMortgage.mutateAsync(fields) : attachMortgage.mutateAsync(fields)),
      existing ? t("realestate.mortgage.updated") : t("realestate.mortgage.added"),
    );
  }

  // In preview mode nothing loads; keep the action so the sign-in prompt shows.
  const ready = Boolean(detail) || !isAuthenticated;

  return (
    <SheetScaffold
      title={existing ? t("realestate.mortgage.titleEdit") : t("realestate.mortgage.titleAdd")}
      primaryLabel={existing ? t("common.actions.save") : t("common.actions.add")}
      onPrimary={ready ? save : undefined}
      primaryDisabled={pending}
      error={error}
    >
      {isError ? (
        <ScreenErrorState
          title={t("common.errors.notFoundTitle")}
          message={t("common.errors.notFoundMessage")}
          onRetry={() => void refetch()}
        />
      ) : !ready && isLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : (
        <>
          <FormSection>
            <AmountField
              label={t("realestate.mortgage.principal")}
              value={principal}
              onChange={setPrincipal}
              testID="mtg-principal"
            />
            <NumberField
              label={t("realestate.mortgage.rate")}
              value={rate}
              onChange={setRate}
              decimal
              suffix="%"
              testID="mtg-rate"
            />
            <AmountField
              label={t("realestate.mortgage.payment")}
              value={payment}
              onChange={setPayment}
              testID="mtg-payment"
            />
          </FormSection>
          <FormSection>
            <NumberField
              label={t("realestate.mortgage.term")}
              value={term}
              onChange={setTerm}
              suffix={t("realestate.mortgage.months")}
              maxLength={3}
              testID="mtg-term"
            />
            <DateField
              label={t("realestate.mortgage.start")}
              value={startDate}
              onChange={setStartDate}
              testID="mtg-start"
            />
          </FormSection>
        </>
      )}
    </SheetScaffold>
  );
}
