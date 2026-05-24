"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx
// Mirrors ux-preview TransactionsScreen Suggestions IA section
// (App.tsx L1333-1357). Empty-state placeholder for story 5-1 — the LLM
// suggestions surface ships in story 6-4 (FR-33 confirmCategorisation).

import { Text, View } from "@pekulo/ui/client";
import { PekuloEmptyState, Section } from "@pekulo/ui";
import { Bot, Check } from "lucide-react";

export function TransactionsSuggestionsSection() {
  const pendingCount = 0; // wired by 6-4

  return (
    <Section
      ariaLabel="Suggestions IA"
      title="Suggestions IA"
      flat
      action={
        <View flexDirection="row" alignItems="center" gap="$2">
          <Bot size={12} strokeWidth={2} aria-hidden />
          <Text color="$colorTertiary" fontSize="$caption">
            {pendingCount} à valider
          </Text>
        </View>
      }
    >
      <PekuloEmptyState
        icon={Check}
        title="Tout est catégorisé"
        message="Vos nouvelles transactions apparaîtront ici dès qu'elles seront importées."
      />
    </Section>
  );
}
