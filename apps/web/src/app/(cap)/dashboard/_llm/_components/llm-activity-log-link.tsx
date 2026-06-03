"use client";

import Link from "next/link";
import { Text } from "@pekulo/ui/client";
import { Section } from "@pekulo/ui";

// Story 6-5 (FR-36) — navigation entry from settings into the 90-day activity
// log. Grayscale text link (AC-6); the "→" affordance mirrors the ux-preview
// SettingsScreen mock. Routes to /dashboard/parametres/journal-ia (under
// (cap)/dashboard/* so the CapShell layout wraps it, lesson 2026-05-27).
export function LlmActivityLogLink() {
  return (
    <Section title="Journal d'activité IA" ariaLabel="Accès au journal d'activité de l'IA">
      <Link href="/dashboard/parametres/journal-ia" style={{ textDecoration: "none" }}>
        <Text color="$colorSecondary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
          Voir le journal d'activité IA (90 derniers jours) →
        </Text>
      </Link>
    </Section>
  );
}
