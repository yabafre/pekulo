"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import type { RealEstate } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useRecordValuation } from "../_hooks/use-record-valuation";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const REALESTATE_NOT_FOUND_MSG = "Bien introuvable (déjà supprimé ?). Recharge la page.";

export interface ValuationUpdateFormProps {
  property: RealEstate;
  onSuccess?: () => void;
}

export function ValuationUpdateForm({ property, onSuccess }: ValuationUpdateFormProps) {
  const { mutate, isPending, error, isSuccess, reset } = useRecordValuation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      amount: String(property.currentValuation),
      valuedOn: new Date().toISOString().slice(0, 10),
    },
    validators: {
      onSubmit: ({ value }) => {
        const amt = Number(value.amount);
        if (!Number.isFinite(amt) || amt < 0) return "Valorisation invalide (>= 0)";
        if (!value.valuedOn) return "Date requise";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      mutate(
        {
          propertyId: property.id,
          amount: Number(value.amount),
          valuedOn: new Date(value.valuedOn),
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError(REALESTATE_NOT_FOUND_MSG);
              return;
            }
            form.reset();
            reset();
            onSuccess?.();
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label="Mettre à jour la valorisation"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <View flexDirection="column" gap="$2" paddingVertical="$2">
        <form.Field name="amount">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="v-amount" color="$colorSecondary" fontSize="$caption">
                Nouvelle valorisation (EUR)
              </Text>
              <input
                id="v-amount"
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
        <form.Field name="valuedOn">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="v-date" color="$colorSecondary" fontSize="$caption">
                Date de valorisation
              </Text>
              <input
                id="v-date"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
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
        {submitError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {submitError}
          </Text>
        )}
        {error && !submitError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {error.message}
          </Text>
        )}
        {isSuccess && !submitError && !error && (
          <Text role="status" color="$success" fontSize="$caption">
            Valorisation enregistrée.
          </Text>
        )}
      </View>
      <View paddingTop="$2">
        <button
          type="submit"
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
          {isPending ? "Enregistrement…" : "Enregistrer la valorisation"}
        </button>
      </View>
    </form>
  );
}
