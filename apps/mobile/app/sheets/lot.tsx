// apps/mobile/app/sheets/lot.tsx
// Record a buy / sell lot on a holding (native iOS form sheet) — the web
// `lot-form.tsx` equivalent calling `holdings.recordLot`. Params: `id` (holding).

import { PekuloSegmentedControl } from "@pekulo/ui";
import { useLocalSearchParams } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useState } from "react";

import {
  AmountField,
  DateField,
  FormSection,
  NumberField,
  TextField,
} from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { parseAmountInput, toUtcDay } from "../../lib/forms";
import { useHoldingMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobilePortfolioData } from "../../lib/hooks/use-mobile-queries";

type LotType = "buy" | "sell";

export default function LotSheet() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { data } = useMobilePortfolioData();
  const { recordLot } = useHoldingMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const index = data?.holdingIds.indexOf(id) ?? -1;
  const holding = index >= 0 ? data?.holdings[index] : undefined;

  const [type, setType] = useState<LotType>("buy");
  const [date, setDate] = useState(() => new Date());
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");

  function save() {
    void run(
      () =>
        recordLot.mutateAsync({
          holdingId: id,
          type,
          occurredOn: toUtcDay(date),
          quantity: parseAmountInput(quantity),
          priceUnit: parseAmountInput(price),
          fees: fees.trim() === "" ? 0 : parseAmountInput(fees),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      type === "buy" ? "Achat enregistré" : "Vente enregistrée",
    );
  }

  return (
    <SheetScaffold
      title={holding ? holding.ticker : "Nouveau mouvement"}
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <PekuloSegmentedControl<LotType>
        ariaLabel="Type de mouvement"
        value={type}
        onChange={setType}
        options={[
          { value: "buy", label: "Achat", icon: ArrowDownLeft },
          { value: "sell", label: "Vente", icon: ArrowUpRight },
        ]}
      />
      <FormSection>
        <DateField
          label="Date"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          testID="lot-date"
        />
        <NumberField
          label="Quantité"
          value={quantity}
          onChange={setQuantity}
          decimal
          testID="lot-quantity"
        />
        <AmountField label="Prix unitaire" value={price} onChange={setPrice} testID="lot-price" />
        <AmountField label="Frais" value={fees} onChange={setFees} testID="lot-fees" />
      </FormSection>
      <FormSection title="Notes">
        <TextField
          label="Notes (facultatif)"
          value={notes}
          onChange={setNotes}
          multiline
          maxLength={500}
          testID="lot-notes"
        />
      </FormSection>
    </SheetScaffold>
  );
}
