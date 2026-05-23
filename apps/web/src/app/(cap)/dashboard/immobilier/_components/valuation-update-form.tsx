"use client";

import { useState } from "react";
import {
  PekuloDatePicker,
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import type { RealEstate } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useRecordValuation } from "../_hooks/use-record-valuation";

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
      valuedOn: new Date(),
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
          valuedOn: value.valuedOn,
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
      <PekuloFieldGroup>
        <form.Field name="amount">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="v-amount">Nouvelle valorisation (EUR)</PekuloFieldLabel>
              <PekuloInput
                id="v-amount"
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
        <form.Field name="valuedOn">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="v-date">Date de valorisation</PekuloFieldLabel>
              <PekuloDatePicker
                id="v-date"
                value={field.state.value}
                onChange={(d) => d && field.handleChange(d)}
              />
            </PekuloField>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(clientError) =>
            clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
          }
        </form.Subscribe>
        {submitError && <PekuloFieldError>{submitError}</PekuloFieldError>}
        {error && !submitError && <PekuloFieldError>{error.message}</PekuloFieldError>}
        {isSuccess && !submitError && !error && (
          <PekuloFieldDescription color="$success">
            Valorisation enregistrée.
          </PekuloFieldDescription>
        )}
      </PekuloFieldGroup>
      <PekuloSubmitButton loading={isPending} loadingLabel="Enregistrement…">
        Enregistrer la valorisation
      </PekuloSubmitButton>
    </form>
  );
}
