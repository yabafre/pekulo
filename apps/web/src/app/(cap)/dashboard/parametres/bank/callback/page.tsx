// apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx
// Story 5-6 — Bridge Connect callback (v3 stateful-widget model).
//
// Bridge v3 redirects back with:
//   ?source=connect&success=true&user_uuid=<uuid>&step=sync_success&item_id=<id>
// NOT the classic OAuth ?code=&state= shape. The widget handles SCA + token
// exchange server-side ; we just receive the finalized item_id + user_uuid.
//
// Failure shapes (Bridge docs):
//   - success=false&error_code=<code>
//   - step ≠ sync_success while success=true (rare partial; treat as error)

import { redirect } from "next/navigation";
import { completeBankConnection } from "../../_actions/bank-aggregator-actions";

interface CallbackPageProps {
  searchParams: Promise<{
    source?: string;
    success?: string;
    step?: string;
    user_uuid?: string;
    item_id?: string;
    error_code?: string;
  }>;
}

export default async function BridgeCallbackPage({ searchParams }: CallbackPageProps) {
  const params = await searchParams;

  if (params.success !== "true" || !params.item_id || !params.user_uuid) {
    return (
      <main aria-label="Erreur callback Bridge">
        <h1>Connexion bancaire interrompue</h1>
        <p>
          La connexion n&apos;a pas abouti côté Bridge (success={params.success ?? "—"}, step=
          {params.step ?? "—"}). Réessaie depuis les paramètres.
        </p>
        {params.error_code ? (
          <p>
            Code d&apos;erreur Bridge : <code>{params.error_code}</code>
          </p>
        ) : null}
      </main>
    );
  }

  const result = await completeBankConnection({
    itemId: params.item_id,
    userUuid: params.user_uuid,
  });

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
