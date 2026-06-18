"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloDatePicker,
  PekuloDialog,
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { MAX_HOLDING_NOTES_LENGTH, type Holding } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useRecordLot } from "../_hooks/use-record-lot";
import formControls from "../../../_components/form-controls.module.css";

function todayLocalMidnight(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  const t = useTranslations("portefeuille");
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useRecordLot();

  const form = useAppForm({
    defaultValues: {
      type: "buy" as "buy" | "sell",
      occurredOn: todayLocalMidnight(),
      quantity: "0",
      priceUnit: initialPriceUnit(holding),
      fees: "0",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const qNum = Number(value.quantity);
        if (!Number.isFinite(qNum) || qNum <= 0) {
          return t("lotQtyInvalid");
        }
        const pNum = Number(value.priceUnit);
        if (!Number.isFinite(pNum) || pNum <= 0) {
          return t("lotPriceInvalid");
        }
        const fNum = Number(value.fees);
        if (!Number.isFinite(fNum) || fNum < 0) {
          return t("feesInvalid");
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
          return t("notesTooLong", { max: MAX_HOLDING_NOTES_LENGTH });
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
          occurredOn: value.occurredOn,
          quantity: qNum,
          priceUnit: pNum,
          fees: fNum,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(
                result.code === "HOLDING_NOT_FOUND" ? t("holdingNotFound") : t("holdingClosed"),
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
              {t("lotTitle", { name: holding.ticker ?? holding.label })}
            </PekuloDialog.Title>
            <PekuloDialog.Description>{t("lotDesc")}</PekuloDialog.Description>
            <form
              id="lot-form-submit"
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              aria-label={t("lotFormAria")}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "55vh",
                overflowY: "auto",
              }}
            >
              <PekuloFieldGroup>
                <form.Field name="type">
                  {(field) => (
                    <PekuloField>
                      <Text color="$colorSecondary" fontSize="$caption">
                        {t("fields.type")}
                      </Text>
                      <div
                        role="radiogroup"
                        aria-label={t("lotTypeAria")}
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
                          {t("buy")}
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="lot-type"
                            value="sell"
                            checked={field.state.value === "sell"}
                            onChange={() => field.handleChange("sell")}
                          />{" "}
                          {t("sell")}
                        </label>
                      </div>
                    </PekuloField>
                  )}
                </form.Field>
                <form.Field name="occurredOn">
                  {(field) => (
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="lot-date">{t("fields.date")}</PekuloFieldLabel>
                      <PekuloDatePicker
                        id="lot-date"
                        value={field.state.value}
                        onChange={(d) => d && field.handleChange(d)}
                      />
                    </PekuloField>
                  )}
                </form.Field>
                <form.Field name="quantity">
                  {(field) => (
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="lot-qty">{t("fields.quantity")}</PekuloFieldLabel>
                      <PekuloInput
                        id="lot-qty"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.currentTarget.value)}
                        required
                      />
                    </PekuloField>
                  )}
                </form.Field>
                <form.Field name="priceUnit">
                  {(field) => (
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="lot-price">
                        {t("fields.priceUnit")}
                      </PekuloFieldLabel>
                      <PekuloInput
                        id="lot-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.currentTarget.value)}
                        required
                      />
                    </PekuloField>
                  )}
                </form.Field>
                <form.Field name="fees">
                  {(field) => (
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="lot-fees">{t("fields.fees")}</PekuloFieldLabel>
                      <PekuloInput
                        id="lot-fees"
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.currentTarget.value)}
                      />
                    </PekuloField>
                  )}
                </form.Field>
                <form.Field name="notes">
                  {(field) => (
                    <PekuloField>
                      <PekuloFieldLabel htmlFor="lot-notes">{t("fields.notes")}</PekuloFieldLabel>
                      <PekuloInput
                        id="lot-notes"
                        type="text"
                        maxLength={MAX_HOLDING_NOTES_LENGTH}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.currentTarget.value)}
                      />
                    </PekuloField>
                  )}
                </form.Field>
                <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                  {(clientError) =>
                    clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
                  }
                </form.Subscribe>
                {envelopeError && (
                  <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                    {(clientError) =>
                      clientError ? null : <PekuloFieldError>{envelopeError}</PekuloFieldError>
                    }
                  </form.Subscribe>
                )}
                {error && !envelopeError && (
                  <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                    {(clientError) =>
                      clientError ? null : <PekuloFieldError>{error.message}</PekuloFieldError>
                    }
                  </form.Subscribe>
                )}
                {isSuccess && !envelopeError && !error && (
                  <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                    {(clientError) =>
                      clientError ? null : (
                        <PekuloFieldDescription color="$success">
                          {t("lotSaved")}
                        </PekuloFieldDescription>
                      )
                    }
                  </form.Subscribe>
                )}
              </PekuloFieldGroup>
            </form>
            <View paddingTop="$2">
              <PekuloSubmitButton
                form="lot-form-submit"
                loading={isPending}
                loadingLabel={t("saving")}
              >
                {t("saveLot")}
              </PekuloSubmitButton>
            </View>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
