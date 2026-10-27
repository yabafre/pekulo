"use client";

import { useEffect } from "react";
import { PekuloButton } from "@pekulo/ui";
import { AlertTriangle } from "lucide-react";

export default function AdvisoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for client observability
  }, [error]);

  return (
    <div
      className="font_body"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 48,
        textAlign: "center",
      }}
    >
      <AlertTriangle size={36} color="var(--negative)" />
      <h2 style={{ fontSize: 18, fontWeight: "bold" }}>
        Une erreur est survenue lors du chargement de l'espace conseil.
      </h2>
      <PekuloButton variant="default" onClick={reset}>
        Réessayer
      </PekuloButton>
    </div>
  );
}
