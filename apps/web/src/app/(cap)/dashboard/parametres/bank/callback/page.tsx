// apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx
// Story 5-6 — Bridge OAuth callback landing.
//
// Route: /dashboard/parametres/bank/callback (under (cap)/dashboard/* so
// CapShell inherits — lesson 2026-05-26).
//
// Bridge redirects the user here with ?code=...&state=... after the connect
// widget flow. This Server Component reads the params, calls the
// completeBankConnection server action, and either redirects to
// /dashboard/parametres on success or renders a minimal error state.
//
// V1 (a) personal-use scope: no rich success affordance — redirect-on-ok is
// enough. 5-7 will replace the error render with a richer "Reconnecter" CTA.

import { redirect } from "next/navigation";
import { completeBankConnection } from "../../_actions/bank-aggregator-actions";

interface CallbackPageProps {
  searchParams: Promise<{ code?: string; state?: string }>;
}

export default async function BridgeCallbackPage({ searchParams }: CallbackPageProps) {
  const { code, state } = await searchParams;

  if (!code || !state) {
    return (
      <main aria-label="Erreur callback Bridge">
        <h1>Connexion bancaire interrompue</h1>
        <p>
          Le code OAuth ou le paramètre <code>state</code> manque dans l&apos;URL. Réessaie depuis
          les paramètres.
        </p>
      </main>
    );
  }

  const result = await completeBankConnection({ code, state });

  if (result.ok) {
    redirect("/dashboard/parametres");
  }

  return (
    <main aria-label="Erreur callback Bridge">
      <h1>Connexion bancaire échouée</h1>
      <p>{result.message}</p>
      <p>
        Code d&apos;erreur : <code>{result.code}</code>
      </p>
    </main>
  );
}
