"use client";

import { SegmentError } from "@/lib/segment-error";

export default function ImmobilierError({
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
      context="immobilier"
      message="Erreur de chargement de l'immobilier."
    />
  );
}
