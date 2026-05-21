"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import type { RealEstate, RealEstateMortgage } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useAttachMortgage } from "../_hooks/use-attach-mortgage";
import { useUpdateMortgage } from "../_hooks/use-update-mortgage";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const REALESTATE_NOT_FOUND_MSG = "Bien introuvable (déjà supprimé ?). Recharge la page.";
const MORTGAGE_ALREADY_ATTACHED_MSG = "Ce bien a déjà un crédit. Modifie celui existant.";
const MORTGAGE_NOT_FOUND_MSG = "Aucun crédit attaché à ce bien.";

export interface MortgageFormProps {
  property: RealEstate;
  mortgage: RealEstateMortgage | null;
  mode: "attach" | "update";
  onSuccess?: () => void;
}

export function MortgageForm({ property, mortgage, mode, onSuccess }: MortgageFormProps) {
  const attach = useAttachMortgage();
  const update = useUpdateMortgage();
  const active = mode === "attach" ? attach : update;
  const { isPending, error, isSuccess, reset } = active;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialDate =
    mortgage?.startDate instanceof Date
      ? mortgage.startDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

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
        startDate: new Date(value.startDate),
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
      <View flexDirection="column" gap="$2" paddingVertical="$2">
        <form.Field name="outstandingPrincipal">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="m-op" color="$colorSecondary" fontSize="$caption">
                Capital restant (EUR)
              </Text>
              <input
                id="m-op"
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
        <form.Field name="annualRate">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="m-ar" color="$colorSecondary" fontSize="$caption">
                Taux annuel (décimal — 0,025 = 2,5 %)
              </Text>
              <input
                id="m-ar"
                type="number"
                min={0}
                max={1}
                step="0.0001"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="monthlyPayment">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="m-mp" color="$colorSecondary" fontSize="$caption">
                Mensualité (EUR)
              </Text>
              <input
                id="m-mp"
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
        <form.Field name="termMonths">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="m-tm" color="$colorSecondary" fontSize="$caption">
                Durée restante (mois)
              </Text>
              <input
                id="m-tm"
                type="number"
                min={1}
                max={600}
                step={1}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="m-sd" color="$colorSecondary" fontSize="$caption">
                Date de début
              </Text>
              <input
                id="m-sd"
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
            {mode === "attach" ? "Crédit ajouté." : "Crédit mis à jour."}
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
          {isPending
            ? mode === "attach"
              ? "Ajout…"
              : "Mise à jour…"
            : mode === "attach"
              ? "Ajouter le crédit"
              : "Mettre à jour le crédit"}
        </button>
      </View>
    </form>
  );
}
