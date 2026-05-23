"use client";

import { useState } from "react";
import {
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloNativeCheckbox,
  PekuloSubmitButton,
} from "@pekulo/ui";
import type { RealEstate, RealEstateRental } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useAttachRental } from "../_hooks/use-attach-rental";
import { useUpdateRental } from "../_hooks/use-update-rental";

const REALESTATE_NOT_FOUND_MSG = "Bien introuvable (déjà supprimé ?). Recharge la page.";
const RENTAL_ALREADY_ATTACHED_MSG = "Ce bien a déjà un loyer. Modifie celui existant.";
const RENTAL_NOT_FOUND_MSG = "Aucun loyer attaché à ce bien.";

// Discriminated union — symmetric with MortgageFormProps. `mode: "update"`
// MUST carry a non-null rental. See mortgage-form.tsx for the same rationale
// (silent degradation to RENTAL_NOT_FOUND when null leaked through).
export type RentalFormProps =
  | { property: RealEstate; mode: "attach"; rental?: never; onSuccess?: () => void }
  | { property: RealEstate; mode: "update"; rental: RealEstateRental; onSuccess?: () => void };

export function RentalForm(props: RentalFormProps) {
  const { property, mode, onSuccess } = props;
  const rental = props.mode === "update" ? props.rental : null;
  const attach = useAttachRental();
  const update = useUpdateRental();
  const active = mode === "attach" ? attach : update;
  const { isPending, error, isSuccess, reset } = active;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      monthlyRent: String(rental?.monthlyRent ?? 0),
      monthlyCharges: String(rental?.monthlyCharges ?? 0),
      furnished: rental?.furnished ?? false,
    },
    validators: {
      onSubmit: ({ value }) => {
        const rent = Number(value.monthlyRent);
        const chg = Number(value.monthlyCharges);
        if (!Number.isFinite(rent) || rent < 0) return "Loyer invalide (>= 0)";
        if (!Number.isFinite(chg) || chg < 0) return "Charges invalides (>= 0)";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const payload = {
        propertyId: property.id,
        monthlyRent: Number(value.monthlyRent),
        monthlyCharges: Number(value.monthlyCharges),
        furnished: value.furnished,
      };
      if (mode === "attach") {
        attach.mutate(payload, {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError(
                result.code === "RENTAL_ALREADY_ATTACHED"
                  ? RENTAL_ALREADY_ATTACHED_MSG
                  : REALESTATE_NOT_FOUND_MSG,
              );
              return;
            }
            form.reset();
            reset();
            onSuccess?.();
          },
        });
      } else {
        update.mutate(payload, {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError(
                result.code === "RENTAL_NOT_FOUND"
                  ? RENTAL_NOT_FOUND_MSG
                  : REALESTATE_NOT_FOUND_MSG,
              );
              return;
            }
            form.reset();
            reset();
            onSuccess?.();
          },
        });
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label={mode === "attach" ? "Ajouter un loyer" : "Modifier le loyer"}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <PekuloFieldGroup>
        <form.Field name="monthlyRent">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="r-rent">Loyer mensuel (EUR)</PekuloFieldLabel>
              <PekuloInput
                id="r-rent"
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
        <form.Field name="monthlyCharges">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="r-chg">Charges mensuelles (EUR)</PekuloFieldLabel>
              <PekuloInput
                id="r-chg"
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
        <form.Field name="furnished">
          {(field) => (
            <PekuloField orientation="horizontal">
              <PekuloFieldLabel htmlFor="r-furn">Meublé</PekuloFieldLabel>
              <PekuloNativeCheckbox
                id="r-furn"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.checked)}
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
            {mode === "attach" ? "Loyer ajouté." : "Loyer mis à jour."}
          </PekuloFieldDescription>
        )}
      </PekuloFieldGroup>
      <PekuloSubmitButton
        loading={isPending}
        loadingLabel={mode === "attach" ? "Ajout…" : "Mise à jour…"}
      >
        {mode === "attach" ? "Ajouter le loyer" : "Mettre à jour le loyer"}
      </PekuloSubmitButton>
    </form>
  );
}
