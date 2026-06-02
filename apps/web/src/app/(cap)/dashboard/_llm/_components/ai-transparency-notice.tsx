"use client";

import { useEffect, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { Sparkles } from "lucide-react";
import { useAiNotice, useMarkAiNotice } from "../_hooks/use-ai-notice";

// Story 6-4 (DR-12 / AC-3) + 6-7 (FR-33 amended / AC-2) — minimal AI
// transparency notice. Shown ONCE (server flag ai_notice_seen_at) when the
// user first encounters AI categorisation: either a pending suggestion
// (suggestions section) OR an auto-applied import row (Récentes section, 6-7).
// Marking it seen persists server-side so it never re-appears (survives reloads
// + devices). The full EU-AI-Act notice + the opt-out→opt-in re-trigger are
// owned by story 11-5. The parent decides WHEN to mount it (T7 guards against a
// double-render when both pending + applied rows exist).
export function AiTransparencyNotice() {
  const { data, isLoading } = useAiNotice();
  const markSeen = useMarkAiNotice();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  // Default to seen until the read resolves → no flash for returning users.
  const seen = data?.seen ?? true;
  const shouldShow = isHydrated && !isLoading && !seen;

  useEffect(() => {
    if (shouldShow && !markSeen.isPending) markSeen.mutate(undefined);
    // Mark on first appearance so AC-3 "appears once" holds across reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;
  return (
    <View
      role="note"
      aria-label="Information sur l'intelligence artificielle"
      flexDirection="row"
      gap="$2"
      alignItems="flex-start"
      padding="$3"
      marginBottom="$2"
      borderRadius="$4"
      backgroundColor="$backgroundMuted"
    >
      <Sparkles size={14} color="var(--colorSecondary)" aria-hidden />
      <Text color="$colorSecondary" fontSize="$xs">
        Vos catégories peuvent être suggérées — ou, pour vos imports (CSV / banque), appliquées
        automatiquement — par un modèle d'IA. Vous gardez le dernier mot : chaque catégorie reste
        modifiable à tout moment. Aucune donnée n'est envoyée à un modèle tiers sans votre accord
        (Paramètres → Intelligence artificielle).
      </Text>
    </View>
  );
}
