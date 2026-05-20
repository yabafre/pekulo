"use client";

import { useEffect, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  MAX_HORIZON_YEARS,
  MAX_OBJECTIF_EUR,
  MIN_HORIZON_YEARS,
  type Compass,
} from "@pekulo/validators";
import { useEditCompassForm } from "../_hooks/use-edit-compass-form";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

export interface CompassEditFormProps {
  initial: Compass | null;
}

export function CompassEditForm({ initial }: CompassEditFormProps) {
  const [objectif, setObjectif] = useState<string>(initial ? String(initial.objectif) : "");
  const [horizonYears, setHorizonYears] = useState<string>(
    initial ? String(initial.horizonYears) : String(MIN_HORIZON_YEARS),
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const { submit, isPending, error, isSuccess } = useEditCompassForm();

  // Re-sync only when the upstream compass row actually changes, never on a
  // referential-identity flip (RSC re-render with same values). Otherwise
  // typing into the form would race a parent re-render and stomp.
  const initialObjectif = initial?.objectif;
  const initialHorizonYears = initial?.horizonYears;
  useEffect(() => {
    if (initialObjectif == null || initialHorizonYears == null) return;
    setObjectif(String(initialObjectif));
    setHorizonYears(String(initialHorizonYears));
  }, [initialObjectif, initialHorizonYears]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const obj = Number(objectif);
    const horizon = Number(horizonYears);
    if (!Number.isFinite(obj) || obj <= 0 || obj > MAX_OBJECTIF_EUR) {
      setClientError(`Objectif invalide (1 → ${MAX_OBJECTIF_EUR.toLocaleString("fr-FR")})`);
      return;
    }
    if (!Number.isInteger(horizon) || horizon < MIN_HORIZON_YEARS || horizon > MAX_HORIZON_YEARS) {
      setClientError(`Horizon invalide (${MIN_HORIZON_YEARS} → ${MAX_HORIZON_YEARS} ans)`);
      return;
    }
    submit({ objectif: obj, horizonYears: horizon });
  };

  return (
    <form onSubmit={onSubmit} aria-label="Modifier le cap">
      <View flexDirection="column" gap="$3" padding="$4">
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
            value={objectif}
            onChange={(e) => setObjectif(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
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
            value={horizonYears}
            onChange={(e) => setHorizonYears(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        {clientError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {clientError}
          </Text>
        )}
        {error && !clientError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {error.message}
          </Text>
        )}
        {isSuccess && !clientError && !error && (
          <Text role="status" color="$success" fontSize="$caption">
            Cap mis à jour.
          </Text>
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
