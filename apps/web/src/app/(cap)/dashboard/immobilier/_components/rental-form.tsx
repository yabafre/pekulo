"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

// Discriminated union — symmetric with MortgageFormProps. `mode: "update"`
// MUST carry a non-null rental. See mortgage-form.tsx for the same rationale
// (silent degradation to RENTAL_NOT_FOUND when null leaked through).
export type RentalFormProps =
  | { property: RealEstate; mode: "attach"; rental?: never; onSuccess?: () => void }
  | { property: RealEstate; mode: "update"; rental: RealEstateRental; onSuccess?: () => void };

export function RentalForm(props: RentalFormProps) {
  const t = useTranslations("immobilier");
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
        if (!Number.isFinite(rent) || rent < 0) return t("rental.errors.rentInvalid");
        if (!Number.isFinite(chg) || chg < 0) return t("rental.errors.chargesInvalid");
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
                  ? t("rental.errors.alreadyAttached")
                  : t("errors.realEstateNotFound"),
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
                  ? t("rental.errors.notFound")
                  : t("errors.realEstateNotFound"),
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
      aria-label={mode === "attach" ? t("rental.attachAria") : t("rental.updateAria")}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <PekuloFieldGroup>
        <form.Field name="monthlyRent">
          {(field) => (
            <PekuloField>
              <PekuloFieldLabel htmlFor="r-rent">{t("rental.fields.monthlyRent")}</PekuloFieldLabel>
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
              <PekuloFieldLabel htmlFor="r-chg">
                {t("rental.fields.monthlyCharges")}
              </PekuloFieldLabel>
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
              <PekuloFieldLabel htmlFor="r-furn">{t("rental.fields.furnished")}</PekuloFieldLabel>
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
            {mode === "attach" ? t("rental.successAdded") : t("rental.successUpdated")}
          </PekuloFieldDescription>
        )}
      </PekuloFieldGroup>
      <PekuloSubmitButton
        loading={isPending}
        loadingLabel={mode === "attach" ? t("rental.loadingAdd") : t("rental.loadingUpdate")}
      >
        {mode === "attach" ? t("rental.submitAdd") : t("rental.submitUpdate")}
      </PekuloSubmitButton>
    </form>
  );
}
