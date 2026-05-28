// apps/web/src/app/(cap)/dashboard/bank/callback/page.tsx
// Story 5-6 — Bridge Connect callback (v3 stateful-widget model).
// Story 5-7 — graceful cancellation handling + redirect target fixed to the
// Patrimoine view (where the connections section now lives).
//
// Bridge v3 redirects back with:
//   ?source=connect&success=true&user_uuid=<uuid>&step=sync_success&item_id=<id>
// On abandon the user comes back with success=false (no error_code) — a
// cancellation, NOT an error. Classification is delegated to the pure
// classifyBridgeCallback helper so the three outcomes stay unit-tested.

import Link from "next/link";
import { redirect } from "next/navigation";
import { type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import { completeBankConnection } from "../../_bank/_actions/bank-aggregator-actions";
import { classifyBridgeCallback, type BridgeCallbackParams } from "./classify-callback";

// Connections live in the Patrimoine view since 5-7 (T13) — NOT /parametres,
// which is compass-only now.
const CONNECTIONS_HREF = "/dashboard?tab=patrimoine";

const ctaPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  height: 40,
  padding: "0 16px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  textDecoration: "none",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
};

function CallbackState({ title, description }: { title: string; description: string }) {
  return (
    <View render="section" aria-label={title} flexDirection="column" gap="$3" paddingVertical="$6">
      <Text render="h1" color="$color" fontSize="$h2" fontWeight="600">
        {title}
      </Text>
      <Text color="$colorTertiary" fontSize="$bodySm">
        {description}
      </Text>
      <Link href={CONNECTIONS_HREF} style={ctaPill}>
        Retour à mes connexions
      </Link>
    </View>
  );
}

export default async function BridgeCallbackPage({
  searchParams,
}: {
  searchParams: Promise<BridgeCallbackParams>;
}) {
  const params = await searchParams;
  const outcome = classifyBridgeCallback(params);

  if (outcome.kind === "cancelled") {
    return (
      <CallbackState
        title="Connexion annulée"
        description="Tu as fermé la fenêtre Bridge avant la fin — aucune banque n'a été ajoutée. Tu peux réessayer quand tu veux."
      />
    );
  }

  if (outcome.kind === "error") {
    return (
      <CallbackState
        title="Connexion bancaire échouée"
        description="La connexion n'a pas pu aboutir côté Bridge. Réessaie dans un instant ; si le problème persiste, contacte ta banque."
      />
    );
  }

  const result = await completeBankConnection({
    itemId: outcome.itemId,
    userUuid: outcome.userUuid,
  });

  if (result.ok) {
    redirect(CONNECTIONS_HREF);
  }

  return (
    <CallbackState
      title="Connexion bancaire échouée"
      description={
        result.code === "BANK_CONNECTION_ALREADY_EXISTS"
          ? "Cette banque est déjà connectée à Pekulo."
          : "La connexion n'a pas pu être finalisée. Réessaie dans un instant."
      }
    />
  );
}
