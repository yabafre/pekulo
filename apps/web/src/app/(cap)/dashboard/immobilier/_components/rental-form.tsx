"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import type { RealEstate, RealEstateRental } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useAttachRental } from "../_hooks/use-attach-rental";
import { useUpdateRental } from "../_hooks/use-update-rental";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const REALESTATE_NOT_FOUND_MSG = "Bien introuvable (déjà supprimé ?). Recharge la page.";
const RENTAL_ALREADY_ATTACHED_MSG = "Ce bien a déjà un loyer. Modifie celui existant.";
const RENTAL_NOT_FOUND_MSG = "Aucun loyer attaché à ce bien.";

export interface RentalFormProps {
  property: RealEstate;
  rental: RealEstateRental | null;
  mode: "attach" | "update";
  onSuccess?: () => void;
}

export function RentalForm({ property, rental, mode, onSuccess }: RentalFormProps) {
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
      <View flexDirection="column" gap="$2" paddingVertical="$2">
        <form.Field name="monthlyRent">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="r-rent" color="$colorSecondary" fontSize="$caption">
                Loyer mensuel (EUR)
              </Text>
              <input
                id="r-rent"
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
        <form.Field name="monthlyCharges">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="r-chg" color="$colorSecondary" fontSize="$caption">
                Charges mensuelles (EUR)
              </Text>
              <input
                id="r-chg"
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
        <form.Field name="furnished">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="r-furn" color="$colorSecondary" fontSize="$caption">
                Meublé
              </Text>
              <input
                id="r-furn"
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.checked)}
                style={{ width: 20, height: 20 }}
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
            {mode === "attach" ? "Loyer ajouté." : "Loyer mis à jour."}
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
              ? "Ajouter le loyer"
              : "Mettre à jour le loyer"}
        </button>
      </View>
    </form>
  );
}
