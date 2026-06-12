"use client";

import { SegmentError } from "@/lib/segment-error";

export default function ParametresError({
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
      context="parametres"
      message="Erreur de chargement des paramètres."
    />
  );
}
