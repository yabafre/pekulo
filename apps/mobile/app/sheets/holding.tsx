// apps/mobile/app/sheets/holding.tsx
// Add a holding (native iOS form sheet), mirroring the web
// `holding-create-form.tsx` fields and validating with
// `createHoldingInputSchema` through `useHoldingMutations`.

import type { HoldingKind } from "@pekulo/types";
import type { HOLDING_CURRENCIES } from "@pekulo/validators";
import { useEffect, useState } from "react";

import {
  AmountField,
  FormSection,
  NumberField,
  SelectField,
  TextField,
} from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { parseAmountInput } from "../../lib/forms";
import { useHoldingMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobilePortfolioData } from "../../lib/hooks/use-mobile-queries";
import { HOLDING_CURRENCY_OPTIONS, HOLDING_KIND_OPTIONS } from "../../lib/options";

type HoldingCurrency = (typeof HOLDING_CURRENCIES)[number];

export default function HoldingSheet() {
  const { data } = useMobilePortfolioData();
  const { create } = useHoldingMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const accountOptions = data?.accountOptions ?? [];

  const [accountId, setAccountId] = useState("");
  const [label, setLabel] = useState("");
  const [ticker, setTicker] = useState("");
  const [isin, setIsin] = useState("");
  const [kind, setKind] = useState<HoldingKind>("etf");
  const [currency, setCurrency] = useState<HoldingCurrency>("EUR");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [notes, setNotes] = useState("");

  const firstAccountId = accountOptions[0]?.value;
  useEffect(() => {
    if (!accountId && firstAccountId) setAccountId(firstAccountId);
  }, [accountId, firstAccountId]);

  function save() {
    void run(
      () =>
        create.mutateAsync({
          accountId,
          ticker: ticker.trim() === "" ? null : ticker.trim().toUpperCase(),
          isin: isin.trim() === "" ? null : isin.trim().toUpperCase(),
          kind,
          currency,
          label: label.trim(),
          quantity: parseAmountInput(quantity),
          avgCost: parseAmountInput(avgCost),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      "Ligne ajoutée",
    );
  }

  return (
    <SheetScaffold
      title="Nouvelle ligne"
      primaryLabel="Ajouter"
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection>
        <TextField
          label="Nom"
          value={label}
          onChange={setLabel}
          placeholder="Amundi MSCI World"
          maxLength={120}
          testID="hld-label"
        />
        <TextField
          label="Ticker (facultatif)"
          value={ticker}
          onChange={setTicker}
          placeholder="CW8"
          autoCapitalize="characters"
          maxLength={32}
          testID="hld-ticker"
        />
        <TextField
          label="ISIN (facultatif)"
          value={isin}
          onChange={setIsin}
          placeholder="LU1681043599"
          autoCapitalize="characters"
          maxLength={32}
          testID="hld-isin"
        />
      </FormSection>
      <FormSection>
        <SelectField
          label="Compte"
          value={accountId}
          options={accountOptions}
          onChange={setAccountId}
          placeholder="Aucun compte"
          testID="hld-account"
        />
        <SelectField
          label="Type"
          value={kind}
          options={HOLDING_KIND_OPTIONS}
          onChange={setKind}
          testID="hld-kind"
        />
        <SelectField
          label="Devise"
          value={currency}
          options={HOLDING_CURRENCY_OPTIONS}
          onChange={setCurrency}
          testID="hld-currency"
        />
      </FormSection>
      <FormSection footer="Le prix de revient unitaire (PRU) sert au calcul de la plus-value.">
        <NumberField
          label="Quantité"
          value={quantity}
          onChange={setQuantity}
          decimal
          testID="hld-quantity"
        />
        <AmountField label="PRU" value={avgCost} onChange={setAvgCost} testID="hld-avgcost" />
      </FormSection>
      <FormSection title="Notes">
        <TextField
          label="Notes (facultatif)"
          value={notes}
          onChange={setNotes}
          multiline
          maxLength={500}
          testID="hld-notes"
        />
      </FormSection>
    </SheetScaffold>
  );
}
