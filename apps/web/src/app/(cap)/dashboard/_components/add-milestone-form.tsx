"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { MAX_LABEL_LENGTH, MAX_TARGET_CAPITAL_EUR } from "@pekulo/validators";
import { useAddMilestoneForm } from "../_hooks/use-add-milestone-form";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../_components/form-primitives";
import submitPill from "../../_components/submit-pill.module.css";

export interface AddMilestoneFormProps {
  milestoneCount: number;
  horizonAbsoluteYearMax: number;
  onSuccess?: () => void;
}

const currentYear = new Date().getUTCFullYear();

export function AddMilestoneForm({
  milestoneCount,
  horizonAbsoluteYearMax,
  onSuccess,
}: AddMilestoneFormProps) {
  const [targetCapital, setTargetCapital] = useState<string>("");
  const [targetYear, setTargetYear] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [clientError, setClientError] = useState<string | null>(null);
  const { submit, isPending, error, capReached } = useAddMilestoneForm({ milestoneCount });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const capital = Number(targetCapital);
    const year = Number(targetYear);
    if (!Number.isFinite(capital) || capital <= 0 || capital > MAX_TARGET_CAPITAL_EUR) {
      setClientError(`Capital invalide (1 → ${MAX_TARGET_CAPITAL_EUR.toLocaleString("fr-FR")})`);
      return;
    }
    if (!Number.isInteger(year) || year < currentYear + 1 || year > horizonAbsoluteYearMax) {
      setClientError(`Année hors plage (${currentYear + 1} → ${horizonAbsoluteYearMax})`);
      return;
    }
    const trimmed = label.trim();
    if (trimmed.length > MAX_LABEL_LENGTH) {
      setClientError(`Libellé > ${MAX_LABEL_LENGTH} caractères`);
      return;
    }
    submit(
      {
        targetCapital: capital,
        targetYear: year,
        label: trimmed.length > 0 ? trimmed : undefined,
      },
      {
        onSuccess: () => {
          setTargetCapital("");
          setTargetYear("");
          setLabel("");
          onSuccess?.();
        },
      },
    );
  };

  const submitDisabled = isPending || capReached;

  return (
    <form onSubmit={onSubmit} aria-label="Ajouter un palier">
      <View flexDirection="column" gap="$3" padding="$4">
        <Field>
          <Text
            render="label"
            htmlFor="milestone-capital"
            color="$colorSecondary"
            fontSize="$caption"
          >
            Capital cible (EUR)
          </Text>
          <input
            id="milestone-capital"
            type="number"
            min={1}
            max={MAX_TARGET_CAPITAL_EUR}
            step={1}
            value={targetCapital}
            onChange={(e) => setTargetCapital(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="milestone-year" color="$colorSecondary" fontSize="$caption">
            Année cible
          </Text>
          <input
            id="milestone-year"
            type="number"
            min={currentYear + 1}
            max={horizonAbsoluteYearMax}
            step={1}
            value={targetYear}
            onChange={(e) => setTargetYear(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text
            render="label"
            htmlFor="milestone-label"
            color="$colorSecondary"
            fontSize="$caption"
          >
            Libellé (optionnel)
          </Text>
          <input
            id="milestone-label"
            type="text"
            maxLength={MAX_LABEL_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
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
        {capReached && (
          <Text role="status" color="$colorSecondary" fontSize="$caption">
            Limite atteinte (20/20)
          </Text>
        )}
        <button
          type="submit"
          disabled={submitDisabled}
          aria-disabled={submitDisabled}
          className={submitPill.pill}
          style={submitStyle(submitDisabled)}
        >
          {isPending ? "Ajout…" : "Ajouter le palier"}
        </button>
      </View>
    </form>
  );
}
