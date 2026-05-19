"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog } from "@pekulo/ui";
import { MAX_HOLDING_NOTES_LENGTH, type Holding } from "@pekulo/validators";
import { useRecordLot } from "../_hooks/use-record-lot";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";

const HOLDING_NOT_FOUND_MSG = "Ce placement est introuvable. Recharge la page.";
const HOLDING_CLOSED_MSG = "Ce placement est clôturé — les lots ne peuvent plus être modifiés.";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const radioRow: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 12,
  alignItems: "center",
};

export interface LotFormProps {
  holding: Holding;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function LotForm({ holding, open, onOpenChange }: LotFormProps) {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [quantity, setQuantity] = useState("0");
  const [priceUnit, setPriceUnit] = useState(String(holding.lastPrice));
  const [fees, setFees] = useState("0");
  const [notes, setNotes] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useRecordLot();

  const handleClose = (next: boolean) => {
    if (!next) {
      setClientError(null);
      setEnvelopeError(null);
      reset();
    }
    onOpenChange(next);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setEnvelopeError(null);
    const qNum = Number(quantity);
    if (!Number.isFinite(qNum) || qNum <= 0) {
      setClientError("Quantité invalide (> 0)");
      return;
    }
    const pNum = Number(priceUnit);
    if (!Number.isFinite(pNum) || pNum < 0) {
      setClientError("Prix unitaire invalide (>= 0)");
      return;
    }
    const fNum = Number(fees);
    if (!Number.isFinite(fNum) || fNum < 0) {
      setClientError("Frais invalides (>= 0)");
      return;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
      setClientError(`Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`);
      return;
    }
    mutate(
      {
        holdingId: holding.id,
        type,
        occurredOn: new Date(occurredOn),
        quantity: qNum,
        priceUnit: pNum,
        fees: fNum,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(
              result.code === "HOLDING_NOT_FOUND" ? HOLDING_NOT_FOUND_MSG : HOLDING_CLOSED_MSG,
            );
            return;
          }
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <PekuloDialog open={open} onOpenChange={handleClose}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <View flexDirection="column" gap="$2">
            <PekuloDialog.Title>
              Enregistrer un lot — {holding.ticker ?? holding.label}
            </PekuloDialog.Title>
            <PekuloDialog.Description>
              Achat ou vente. Le WAC se recalcule automatiquement.
            </PekuloDialog.Description>
            <form
              id="lot-form-submit"
              onSubmit={onSubmit}
              aria-label="Enregistrer un lot"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "55vh",
                overflowY: "auto",
              }}
            >
              <Field>
                <Text color="$colorSecondary" fontSize="$caption">
                  Type
                </Text>
                <div role="radiogroup" aria-label="Type de lot" style={radioRow}>
                  <label>
                    <input
                      type="radio"
                      name="lot-type"
                      value="buy"
                      checked={type === "buy"}
                      onChange={() => setType("buy")}
                    />{" "}
                    Achat
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="lot-type"
                      value="sell"
                      checked={type === "sell"}
                      onChange={() => setType("sell")}
                    />{" "}
                    Vente
                  </label>
                </div>
              </Field>
              <Field>
                <Text render="label" htmlFor="lot-date" color="$colorSecondary" fontSize="$caption">
                  Date
                </Text>
                <input
                  id="lot-date"
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.currentTarget.value)}
                  required
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Text render="label" htmlFor="lot-qty" color="$colorSecondary" fontSize="$caption">
                  Quantité
                </Text>
                <input
                  id="lot-qty"
                  type="number"
                  min="0.0001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.currentTarget.value)}
                  required
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Text
                  render="label"
                  htmlFor="lot-price"
                  color="$colorSecondary"
                  fontSize="$caption"
                >
                  Prix unitaire
                </Text>
                <input
                  id="lot-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.currentTarget.value)}
                  required
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Text render="label" htmlFor="lot-fees" color="$colorSecondary" fontSize="$caption">
                  Frais
                </Text>
                <input
                  id="lot-fees"
                  type="number"
                  min={0}
                  step="0.01"
                  value={fees}
                  onChange={(e) => setFees(e.currentTarget.value)}
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Text
                  render="label"
                  htmlFor="lot-notes"
                  color="$colorSecondary"
                  fontSize="$caption"
                >
                  Notes (optionnel)
                </Text>
                <input
                  id="lot-notes"
                  type="text"
                  maxLength={MAX_HOLDING_NOTES_LENGTH}
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  style={inputStyle}
                />
              </Field>
              {clientError && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {clientError}
                </Text>
              )}
              {envelopeError && !clientError && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {envelopeError}
                </Text>
              )}
              {error && !clientError && !envelopeError && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {error.message}
                </Text>
              )}
              {isSuccess && !clientError && !envelopeError && !error && (
                <Text role="status" color="$success" fontSize="$caption">
                  Lot enregistré.
                </Text>
              )}
            </form>
            <View paddingTop="$2">
              <button
                type="submit"
                form="lot-form-submit"
                disabled={isPending}
                aria-disabled={isPending}
                style={{
                  ...submitStyle(isPending),
                  alignSelf: "stretch",
                  width: "100%",
                  height: 48,
                  padding: "0 24px",
                  marginTop: 0,
                  fontSize: 15,
                }}
              >
                {isPending ? "Enregistrement…" : "Enregistrer le lot"}
              </button>
            </View>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
