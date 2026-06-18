"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloDatePicker,
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSelect,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { PROPERTY_TYPES, type PropertyType } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useCreateProperty } from "../_hooks/use-create-property";

export interface PropertyCreateFormProps {
  onSuccess?: () => void;
}

export function PropertyCreateForm({ onSuccess }: PropertyCreateFormProps) {
  const t = useTranslations("immobilier");
  const TYPE_LABEL: Record<PropertyType, string> = {
    "residence-principale": t("propertyType.residencePrincipale"),
    locatif: t("propertyType.locatif"),
    autre: t("propertyType.autre"),
  };
  const { mutate, isPending, error, isSuccess, reset } = useCreateProperty();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      label: "",
      propertyType: "residence-principale" as PropertyType,
      currentValuation: "0",
      lastValuedOn: new Date(),
    },
    validators: {
      onSubmit: ({ value }) => {
        const label = value.label.trim();
        if (label.length === 0) return t("create.errors.labelRequired");
        if (label.length > 120) return t("create.errors.labelTooLong", { max: 120 });
        const val = Number(value.currentValuation);
        if (!Number.isFinite(val) || val < 0) return t("create.errors.valuationInvalid");
        if (!value.lastValuedOn) return t("create.errors.valuationDateRequired");
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
          lastValuedOn: value.lastValuedOn,
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setSubmitError(t("create.errors.generic"));
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
      aria-label={t("create.formAria")}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <PekuloFieldGroup>
        <form.Field name="label">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="re-label">{t("create.fields.label")}</PekuloFieldLabel>
              <PekuloInput
                id="re-label"
                type="text"
                maxLength={120}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
              />
            </PekuloField>
          )}
        </form.Field>
        <form.Field name="propertyType">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="re-type">{t("create.fields.type")}</PekuloFieldLabel>
              <PekuloSelect
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as PropertyType)}
              >
                <PekuloSelect.Trigger id="re-type">
                  <PekuloSelect.Value placeholder={t("create.typePlaceholder")} />
                </PekuloSelect.Trigger>
                <PekuloSelect.Content>
                  <PekuloSelect.Group>
                    {PROPERTY_TYPES.map((opt, i) => (
                      <PekuloSelect.Item key={opt} value={opt} index={i}>
                        {TYPE_LABEL[opt]}
                      </PekuloSelect.Item>
                    ))}
                  </PekuloSelect.Group>
                </PekuloSelect.Content>
              </PekuloSelect>
            </PekuloField>
          )}
        </form.Field>
        <form.Field name="currentValuation">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="re-val">{t("create.fields.valuation")}</PekuloFieldLabel>
              <PekuloInput
                id="re-val"
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
        <form.Field name="lastValuedOn">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="re-date">
                {t("create.fields.valuationDate")}
              </PekuloFieldLabel>
              <PekuloDatePicker
                id="re-date"
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
          <PekuloFieldDescription color="$success">{t("create.success")}</PekuloFieldDescription>
        )}
      </PekuloFieldGroup>
      <PekuloSubmitButton loading={isPending} loadingLabel={t("create.loading")}>
        {t("create.submit")}
      </PekuloSubmitButton>
    </form>
  );
}
