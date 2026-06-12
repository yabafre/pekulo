"use client";

import { SegmentError } from "@/lib/segment-error";

export default function PortefeuilleError({
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
      context="portefeuille"
      message="Erreur de chargement du portefeuille."
    />
  );
}
