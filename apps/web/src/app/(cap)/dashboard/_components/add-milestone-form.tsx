"use client";

import { Text, View } from "@pekulo/ui/client";
import { MAX_LABEL_LENGTH, MAX_TARGET_CAPITAL_EUR } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
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
  const { submit, isPending, error, capReached } = useAddMilestoneForm({ milestoneCount });

  const form = useAppForm({
    defaultValues: { targetCapital: "", targetYear: "", label: "" },
    validators: {
      onSubmit: ({ value }) => {
        const capital = Number(value.targetCapital);
        if (!Number.isFinite(capital) || capital <= 0 || capital > MAX_TARGET_CAPITAL_EUR) {
          return `Capital invalide (1 → ${MAX_TARGET_CAPITAL_EUR.toLocaleString("fr-FR")})`;
        }
        const year = Number(value.targetYear);
        if (!Number.isInteger(year) || year < currentYear + 1 || year > horizonAbsoluteYearMax) {
          return `Année hors plage (${currentYear + 1} → ${horizonAbsoluteYearMax})`;
        }
        if (value.label.trim().length > MAX_LABEL_LENGTH) {
          return `Libellé > ${MAX_LABEL_LENGTH} caractères`;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.label.trim();
      submit(
        {
          targetCapital: Number(value.targetCapital),
          targetYear: Number(value.targetYear),
          label: trimmed.length > 0 ? trimmed : undefined,
        },
        {
          onSuccess: () => {
            form.reset();
            onSuccess?.();
          },
        },
      );
    },
  });

  const submitDisabled = isPending || capReached;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label="Ajouter un palier"
    >
      <View flexDirection="column" gap="$3" padding="$4">
        <form.Field name="targetCapital">
          {(field) => (
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
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="targetYear">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="milestone-year"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Année cible
              </Text>
              <input
                id="milestone-year"
                type="number"
                min={currentYear + 1}
                max={horizonAbsoluteYearMax}
                step={1}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="label">
          {(field) => (
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
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
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
