"use client";

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
import { MAX_LABEL_LENGTH, MAX_TARGET_CAPITAL_EUR } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useAddMilestoneForm } from "../_hooks/use-add-milestone-form";

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
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="targetCapital">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="milestone-capital">Capital cible (EUR)</PekuloFieldLabel>
                <PekuloInput
                  id="milestone-capital"
                  type="number"
                  min={1}
                  max={MAX_TARGET_CAPITAL_EUR}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="targetYear">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="milestone-year">Année cible</PekuloFieldLabel>
                <PekuloInput
                  id="milestone-year"
                  type="number"
                  min={currentYear + 1}
                  max={horizonAbsoluteYearMax}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="milestone-label">Libellé (optionnel)</PekuloFieldLabel>
                <PekuloInput
                  id="milestone-label"
                  type="text"
                  maxLength={MAX_LABEL_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
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
          {capReached && (
            <PekuloFieldDescription role="status">Limite atteinte (20/20)</PekuloFieldDescription>
          )}
          <PekuloSubmitButton
            loading={isPending}
            loadingLabel="Ajout…"
            disabled={submitDisabled}
            aria-disabled={submitDisabled}
          >
            Ajouter le palier
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
