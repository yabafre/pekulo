"use client";

import { PekuloErrorBoundary } from "@pekulo/ui";

export default function TransactionsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PekuloErrorBoundary>
      <div role="alert" style={{ padding: 24 }}>
        <p>Erreur de chargement des transactions.</p>
        <p style={{ opacity: 0.7 }}>{error.message}</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </div>
    </PekuloErrorBoundary>
  );
}
