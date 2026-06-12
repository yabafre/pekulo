"use client";

import { SegmentError } from "@/lib/segment-error";

export default function DashboardError({
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
      context="dashboard"
      message="Erreur de chargement du tableau de bord."
    />
  );
}
