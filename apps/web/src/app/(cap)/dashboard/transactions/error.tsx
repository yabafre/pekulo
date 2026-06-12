"use client";

import { SegmentError } from "@/lib/segment-error";

export default function TransactionsError({
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
      context="transactions"
      message="Erreur de chargement des transactions."
    />
  );
}
