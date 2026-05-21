"use client";

import { useEffect } from "react";
import { Text, View } from "@pekulo/ui/client";
import { MAX_HORIZON_YEARS, MAX_OBJECTIF_EUR, MIN_HORIZON_YEARS } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useCompass } from "../_hooks/use-compass";
import { useEditCompassForm } from "../_hooks/use-edit-compass-form";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

// Form reads the compass row through `useCompass()` directly — no
// `initial` prop. The parametres RSC page no longer prefetches; React
// Query owns the read and post-mutation invalidation reactively
// refreshes the displayed values. Phase D of ZAP-2 migrates the field
// state to TanStack `useAppForm`; this iteration retains the controlled
// inputs to keep the diff scope tight.

export function CompassEditForm() {
  const { data: compass } = useCompass();
  const { submit, isPending, error, isSuccess } = useEditCompassForm();

  const form = useAppForm({
    defaultValues: { objectif: "", horizonYears: String(MIN_HORIZON_YEARS) },
    validators: {
      onSubmit: ({ value }) => {
        const obj = Number(value.objectif);
        if (!Number.isFinite(obj) || obj <= 0 || obj > MAX_OBJECTIF_EUR) {
          return `Objectif invalide (1 → ${MAX_OBJECTIF_EUR.toLocaleString("fr-FR")})`;
        }
        const horizon = Number(value.horizonYears);
        if (
          !Number.isInteger(horizon) ||
          horizon < MIN_HORIZON_YEARS ||
          horizon > MAX_HORIZON_YEARS
        ) {
          return `Horizon invalide (${MIN_HORIZON_YEARS} → ${MAX_HORIZON_YEARS} ans)`;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      submit({
        objectif: Number(value.objectif),
        horizonYears: Number(value.horizonYears),
      });
    },
  });

  const compassObjectif = compass?.objectif;
  const compassHorizonYears = compass?.horizonYears;
  useEffect(() => {
    if (compassObjectif == null || compassHorizonYears == null) return;
    form.reset({
      objectif: String(compassObjectif),
      horizonYears: String(compassHorizonYears),
    });
  }, [compassObjectif, compassHorizonYears, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label="Modifier le cap"
    >
      <View flexDirection="column" gap="$3" padding="$4">
        <form.Field name="objectif">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="compass-objectif"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Objectif (EUR)
              </Text>
              <input
                id="compass-objectif"
                type="number"
                min={1}
                max={MAX_OBJECTIF_EUR}
                step={1}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="horizonYears">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="compass-horizon"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Horizon (années)
              </Text>
              <input
                id="compass-horizon"
                type="number"
                min={MIN_HORIZON_YEARS}
                max={MAX_HORIZON_YEARS}
                step={1}
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
        {error && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {error.message}
                </Text>
              )
            }
          </form.Subscribe>
        )}
        {isSuccess && !error && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="status" color="$success" fontSize="$caption">
                  Cap mis à jour.
                </Text>
              )
            }
          </form.Subscribe>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          className={submitPill.pill}
          style={submitStyle(isPending)}
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </View>
    </form>
  );
}
