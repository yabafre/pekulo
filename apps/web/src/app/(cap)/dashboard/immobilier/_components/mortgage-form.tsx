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
import type { RealEstate, RealEstateMortgage } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useAttachMortgage } from "../_hooks/use-attach-mortgage";
import { useUpdateMortgage } from "../_hooks/use-update-mortgage";

const REALESTATE_NOT_FOUND_MSG = "Bien introuvable (déjà supprimé ?). Recharge la page.";
const MORTGAGE_ALREADY_ATTACHED_MSG = "Ce bien a déjà un crédit. Modifie celui existant.";
const MORTGAGE_NOT_FOUND_MSG = "Aucun crédit attaché à ce bien.";

// Discriminated union so `mode: "update"` MUST carry a non-null mortgage.
// Pre-fix the prop was `mortgage: RealEstateMortgage | null` for both
// modes, so an `update` call with `mortgage=null` typechecked, silently
// defaulted every numeric field to 0, sent the mutation, and bounced
// on MORTGAGE_NOT_FOUND. The discriminated shape makes the invalid
// combination a type error instead.
export type MortgageFormProps =
  | { property: RealEstate; mode: "attach"; mortgage?: never; onSuccess?: () => void }
  | { property: RealEstate; mode: "update"; mortgage: RealEstateMortgage; onSuccess?: () => void };

export function MortgageForm(props: MortgageFormProps) {
  const { property, mode, onSuccess } = props;
  const mortgage = props.mode === "update" ? props.mortgage : null;
  const attach = useAttachMortgage();
  const update = useUpdateMortgage();
  const active = mode === "attach" ? attach : update;
  const { isPending, error, isSuccess, reset } = active;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialDate = mortgage?.startDate instanceof Date ? mortgage.startDate : new Date();

  const form = useAppForm({
    defaultValues: {
      outstandingPrincipal: String(mortgage?.outstandingPrincipal ?? 0),
      annualRate: String(mortgage?.annualRate ?? 0),
      monthlyPayment: String(mortgage?.monthlyPayment ?? 0),
      termMonths: String(mortgage?.termMonths ?? 240),
      startDate: initialDate,
    },
    validators: {
      onSubmit: ({ value }) => {
        const op = Number(value.outstandingPrincipal);
        const ar = Number(value.annualRate);
        const mp = Number(value.monthlyPayment);
        const tm = Number(value.termMonths);
        if (!Number.isFinite(op) || op < 0) return "Capital restant invalide (>= 0)";
        if (!Number.isFinite(ar) || ar < 0 || ar > 1) return "Taux invalide (entre 0 et 1)";
        if (!Number.isFinite(mp) || mp < 0) return "Mensualité invalide (>= 0)";
        if (!Number.isInteger(tm) || tm < 1 || tm > 600) return "Durée invalide (1-600 mois)";
        if (!value.startDate) return "Date de début requise";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const payload = {
        propertyId: property.id,
        outstandingPrincipal: Number(value.outstandingPrincipal),
        annualRate: Number(value.annualRate),
        monthlyPayment: Number(value.monthlyPayment),
        termMonths: Number(value.termMonths),
        startDate: value.startDate,
      };
      if (mode === "attach") {
        attach.mutate(payload, {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError(
                result.code === "MORTGAGE_ALREADY_ATTACHED"
                  ? MORTGAGE_ALREADY_ATTACHED_MSG
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
                result.code === "MORTGAGE_NOT_FOUND"
                  ? MORTGAGE_NOT_FOUND_MSG
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
      aria-label={mode === "attach" ? "Ajouter un crédit" : "Modifier le crédit"}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <PekuloFieldGroup>
        <form.Field name="outstandingPrincipal">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="m-op">Capital restant (EUR)</PekuloFieldLabel>
              <PekuloInput
                id="m-op"
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
        <form.Field name="annualRate">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="m-ar">
                Taux annuel (décimal — 0,025 = 2,5 %)
              </PekuloFieldLabel>
              <PekuloInput
                id="m-ar"
                type="number"
                min={0}
                max={1}
                step="0.0001"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
              />
            </PekuloField>
          )}
        </form.Field>
        <form.Field name="monthlyPayment">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="m-mp">Mensualité (EUR)</PekuloFieldLabel>
              <PekuloInput
                id="m-mp"
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
        <form.Field name="termMonths">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="m-tm">Durée restante (mois)</PekuloFieldLabel>
              <PekuloInput
                id="m-tm"
                type="number"
                min={1}
                max={600}
                step={1}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
              />
            </PekuloField>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="m-sd">Date de début</PekuloFieldLabel>
              <PekuloDatePicker
                id="m-sd"
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
            {mode === "attach" ? "Crédit ajouté." : "Crédit mis à jour."}
          </PekuloFieldDescription>
        )}
      </PekuloFieldGroup>
      <PekuloSubmitButton
        loading={isPending}
        loadingLabel={mode === "attach" ? "Ajout…" : "Mise à jour…"}
      >
        {mode === "attach" ? "Ajouter le crédit" : "Mettre à jour le crédit"}
      </PekuloSubmitButton>
    </form>
  );
}
