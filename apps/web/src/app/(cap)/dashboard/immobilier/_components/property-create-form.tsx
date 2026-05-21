"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PROPERTY_TYPES, type PropertyType } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useCreateProperty } from "../_hooks/use-create-property";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const TYPE_LABEL: Record<PropertyType, string> = {
  "residence-principale": "Résidence principale",
  locatif: "Locatif",
  autre: "Autre",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

export interface PropertyCreateFormProps {
  onSuccess?: () => void;
}

export function PropertyCreateForm({ onSuccess }: PropertyCreateFormProps) {
  const { mutate, isPending, error, isSuccess, reset } = useCreateProperty();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      label: "",
      propertyType: "residence-principale" as PropertyType,
      currentValuation: "0",
      lastValuedOn: new Date().toISOString().slice(0, 10),
    },
    validators: {
      onSubmit: ({ value }) => {
        const label = value.label.trim();
        if (label.length === 0) return "Libellé requis";
        if (label.length > 120) return "Libellé > 120 caractères";
        const val = Number(value.currentValuation);
        if (!Number.isFinite(val) || val < 0) return "Valorisation invalide (>= 0)";
        if (!value.lastValuedOn) return "Date de valorisation requise";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      mutate(
        {
          label: value.label.trim(),
          propertyType: value.propertyType,
          currentValuation: Number(value.currentValuation),
          lastValuedOn: new Date(value.lastValuedOn),
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError("Une erreur est survenue. Recharge la page.");
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
      aria-label="Ajouter un bien immobilier"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <View flexDirection="column" gap="$2" paddingVertical="$2">
        <form.Field name="label">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="re-label" color="$colorSecondary" fontSize="$caption">
                Libellé
              </Text>
              <input
                id="re-label"
                type="text"
                maxLength={120}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="propertyType">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="re-type" color="$colorSecondary" fontSize="$caption">
                Type
              </Text>
              <select
                id="re-type"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value as PropertyType)}
                style={selectStyle}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="currentValuation">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="re-val" color="$colorSecondary" fontSize="$caption">
                Valorisation (EUR)
              </Text>
              <input
                id="re-val"
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
        <form.Field name="lastValuedOn">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="re-date" color="$colorSecondary" fontSize="$caption">
                Date de valorisation
              </Text>
              <input
                id="re-date"
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
            Bien ajouté.
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
          {isPending ? "Ajout…" : "Ajouter le bien"}
        </button>
      </View>
    </form>
  );
}
