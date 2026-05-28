"use client";

// TEMP 5-6 dev affordance — replace via 5-7 (FR-62 settings connections panel).
//
// Story 5-7 will ship the full connections section: list of active items,
// per-item status badge (active / sca_required / revoked), Reconnecter CTA
// on SCA expiry, rename + revoke actions. Until then, this button is the
// only UI entry point to exercise the connect flow end-to-end during dev.
//
// Story 5-6 (post-review aped-review): moved out of /dashboard/parametres
// into the patrimoine tab — Bridge connections belong with the patrimoine
// view (AccountsSection sibling), not with compass settings. The 5-7
// connections panel will fully replace this button when it lands. The
// cross-feature hook import below (`../parametres/_hooks/...`) is
// intentional for the TEMP window — 5-7 owns the proper hooks placement.

import { useState } from "react";
import { useInitiateBankConnection } from "../parametres/_hooks/use-initiate-bank-connection";

export function ConnectBankButton() {
  const mutation = useInitiateBankConnection();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    // The redirect URI MUST match what's configured in the Bridge dashboard's
    // "Allowed redirect URIs" list. Dev default — apps/web on port 3000.
    const redirectUri =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/parametres/bank/callback`
        : undefined;

    mutation.mutate(
      { redirectUri },
      {
        onSuccess: (result) => {
          if (result.ok) {
            window.location.href = result.data.connectUrl;
          } else {
            setError(`${result.code} — ${result.message}`);
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "unknown error");
        },
      },
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={mutation.isPending}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid #444",
          background: mutation.isPending ? "#222" : "#1a1a1a",
          color: "white",
          cursor: mutation.isPending ? "not-allowed" : "pointer",
          fontSize: 14,
        }}
      >
        {mutation.isPending ? "Ouverture Bridge…" : "🔗 Connecter ma banque (Bridge) — TEMP 5-6"}
      </button>
      {error ? (
        <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
