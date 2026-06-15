"use client";

import { SegmentError } from "@/lib/segment-error";

export default function RecoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      error={error}
      reset={reset}
      context="recover"
      message="Erreur lors de la réinitialisation du mot de passe."
    />
  );
}
