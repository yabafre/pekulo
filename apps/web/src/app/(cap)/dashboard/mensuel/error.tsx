"use client";

import { SegmentError } from "@/lib/segment-error";

export default function MensuelError({
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
      context="mensuel"
      message="Erreur de chargement du suivi mensuel."
    />
  );
}
