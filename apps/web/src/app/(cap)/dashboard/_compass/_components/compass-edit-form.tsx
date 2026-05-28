"use client";

import { useEffect } from "react";
import {
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { MAX_HORIZON_YEARS, MAX_OBJECTIF_EUR, MIN_HORIZON_YEARS } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useCompass } from "../_hooks/use-compass";
import { useEditCompassForm } from "../_hooks/use-edit-compass-form";

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
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="objectif">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="compass-objectif">Objectif (EUR)</PekuloFieldLabel>
                <PekuloInput
                  id="compass-objectif"
                  type="number"
                  min={1}
                  max={MAX_OBJECTIF_EUR}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="horizonYears">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="compass-horizon">Horizon (années)</PekuloFieldLabel>
                <PekuloInput
                  id="compass-horizon"
                  type="number"
                  min={MIN_HORIZON_YEARS}
                  max={MAX_HORIZON_YEARS}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
            }
          </form.Subscribe>
          {error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{error.message}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          {isSuccess && !error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : (
                  <PekuloFieldDescription color="$success">Cap mis à jour.</PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel="Enregistrement…">
            Enregistrer
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
