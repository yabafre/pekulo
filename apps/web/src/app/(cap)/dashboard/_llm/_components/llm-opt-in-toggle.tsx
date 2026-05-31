"use client";

import { useEffect, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloToggleRow, Section } from "@pekulo/ui";
import { useLlmOptIn, useSetLlmOptIn } from "../_hooks/use-llm-opt-in";

// Story 6-3 (FR-34 / NFR-13 / DR-7) — the "Intelligence artificielle" settings
// section. The server is the single source of truth for the opt-in (read via
// useLlmOptIn); the toggle writes via useSetLlmOptIn and the registry
// invalidates the read so the state persists across reloads. Default OFF until
// the read resolves. Hydration-guarded (lessons.md 2026-05-24).
export function LlmOptInToggle() {
  const { data, isLoading, error } = useLlmOptIn();
  const setOptIn = useSetLlmOptIn();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;
  const checked = data?.thirdParty ?? false;
  return (
    <Section title="Intelligence artificielle" ariaLabel="Paramètres d'intelligence artificielle">
      <PekuloToggleRow
        label="Modèles d'IA tiers"
        sub="Autoriser l'envoi de certaines transactions à une API tierce (Claude / Mistral) pour la catégorisation. Désactivé par défaut."
        checked={checked}
        disabled={showLoading || setOptIn.isPending}
        onChange={(v) => setOptIn.mutate({ thirdParty: v })}
      />
      {showLoading && (
        // Visually-hidden live region so AT hears why the switch is inert while
        // the server opt-in resolves (mirrors compass-history-panel.tsx).
        <View
          role="status"
          aria-live="polite"
          position="absolute"
          width={1}
          height={1}
          overflow="hidden"
        >
          <Text color="$colorTertiary" fontSize="$caption">
            Chargement…
          </Text>
        </View>
      )}
      {error && !showLoading && (
        <Text role="alert" color="$danger" fontSize="$caption">
          {error.message}
        </Text>
      )}
    </Section>
  );
}
