"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog } from "@pekulo/ui";
import { MAX_HOLDING_NOTES_LENGTH, type Holding } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useRecordLot } from "../_hooks/use-record-lot";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";
import formControls from "../../../_components/form-controls.module.css";

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

// When the holding has no quote yet (lastPrice === 0), prefilling the form
// with "0" risks recording a buy lot at zero — silent WAC corruption on a
// fast-click. Fall back to the holding's avgCost; if that is also 0 leave
// the field empty so the > 0 client-side guard fires.
function initialPriceUnit(h: Holding): string {
  if (h.lastPrice > 0) return String(h.lastPrice);
  if (h.avgCost > 0) return String(h.avgCost);
  return "";
}

export function LotForm({ holding, open, onOpenChange }: LotFormProps) {
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useRecordLot();

  const form = useAppForm({
    defaultValues: {
      type: "buy" as "buy" | "sell",
      occurredOn: todayIso(),
      quantity: "0",
      priceUnit: initialPriceUnit(holding),
      fees: "0",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const qNum = Number(value.quantity);
        if (!Number.isFinite(qNum) || qNum <= 0) {
          return "Quantité invalide (> 0)";
        }
        const pNum = Number(value.priceUnit);
        if (!Number.isFinite(pNum) || pNum <= 0) {
          return "Prix unitaire invalide (> 0)";
        }
        const fNum = Number(value.fees);
        if (!Number.isFinite(fNum) || fNum < 0) {
          return "Frais invalides (>= 0)";
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
          return `Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const qNum = Number(value.quantity);
      const pNum = Number(value.priceUnit);
      const fNum = Number(value.fees);
      const trimmedNotes = value.notes.trim();
      setEnvelopeError(null);
      mutate(
        {
          holdingId: holding.id,
          type: value.type,
          occurredOn: new Date(value.occurredOn),
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
    },
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setEnvelopeError(null);
      reset();
    }
    onOpenChange(next);
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
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              aria-label="Enregistrer un lot"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "55vh",
                overflowY: "auto",
              }}
            >
              <form.Field name="type">
                {(field) => (
                  <Field>
                    <Text color="$colorSecondary" fontSize="$caption">
                      Type
                    </Text>
                    <div
                      role="radiogroup"
                      aria-label="Type de lot"
                      style={radioRow}
                      className={formControls.radioGroup}
                    >
                      <label>
                        <input
                          type="radio"
                          name="lot-type"
                          value="buy"
                          checked={field.state.value === "buy"}
                          onChange={() => field.handleChange("buy")}
                        />{" "}
                        Achat
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="lot-type"
                          value="sell"
                          checked={field.state.value === "sell"}
                          onChange={() => field.handleChange("sell")}
                        />{" "}
                        Vente
                      </label>
                    </div>
                  </Field>
                )}
              </form.Field>
              <form.Field name="occurredOn">
                {(field) => (
                  <Field>
                    <Text
                      render="label"
                      htmlFor="lot-date"
                      color="$colorSecondary"
                      fontSize="$caption"
                    >
                      Date
                    </Text>
                    <input
                      id="lot-date"
                      type="date"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.currentTarget.value)}
                      required
                      style={inputStyle}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="quantity">
                {(field) => (
                  <Field>
                    <Text
                      render="label"
                      htmlFor="lot-qty"
                      color="$colorSecondary"
                      fontSize="$caption"
                    >
                      Quantité
                    </Text>
                    <input
                      id="lot-qty"
                      type="number"
                      min="0.0001"
                      step="any"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.currentTarget.value)}
                      required
                      style={inputStyle}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="priceUnit">
                {(field) => (
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
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.currentTarget.value)}
                      required
                      style={inputStyle}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="fees">
                {(field) => (
                  <Field>
                    <Text
                      render="label"
                      htmlFor="lot-fees"
                      color="$colorSecondary"
                      fontSize="$caption"
                    >
                      Frais
                    </Text>
                    <input
                      id="lot-fees"
                      type="number"
                      min={0}
                      step="0.01"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.currentTarget.value)}
                      style={inputStyle}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="notes">
                {(field) => (
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
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.currentTarget.value)}
                      style={inputStyle}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                {(clientError) =>
                  clientError ? (
                    <Text role="alert" color="$danger" fontSize="$caption">
                      {String(clientError)}
                    </Text>
                  ) : null
                }
              </form.Subscribe>
              {envelopeError && (
                <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                  {(clientError) =>
                    clientError ? null : (
                      <Text role="alert" color="$danger" fontSize="$caption">
                        {envelopeError}
                      </Text>
                    )
                  }
                </form.Subscribe>
              )}
              {error && !envelopeError && (
                <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                  {(clientError) =>
                    clientError ? null : (
                      <Text role="alert" color="$danger" fontSize="$caption">
                        {error.message}
                      </Text>
                    )
                  }
                </form.Subscribe>
              )}
              {isSuccess && !envelopeError && !error && (
                <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                  {(clientError) =>
                    clientError ? null : (
                      <Text role="status" color="$success" fontSize="$caption">
                        Lot enregistré.
                      </Text>
                    )
                  }
                </form.Subscribe>
              )}
            </form>
            <View paddingTop="$2">
              <button
                type="submit"
                form="lot-form-submit"
                disabled={isPending}
                aria-disabled={isPending}
                className={submitPill.pill}
                style={{
                  ...submitStyle(isPending),
                  alignSelf: "stretch",
                  width: "100%",
                  height: 44,
                  padding: "0 24px",
                  marginTop: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: 0.01,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
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
