"use client";

import { useUpdateCompass } from "./use-update-compass";

// Thin orchestrator: the form component owns field state (controlled inputs)
// — TanStack Form is reserved for forms with field-level async validation;
// compass edit has only Zod-validated submit. Same pattern as
// useAddMilestoneForm (T19).
export function useEditCompassForm() {
  const mutation = useUpdateCompass();
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
}
