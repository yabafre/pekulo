"use client";

import { SegmentError } from "@/lib/segment-error";

export default function AdvisoryError({
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
      context="advisory"
      message="Erreur de chargement du conseil financier."
    />
  );
}
