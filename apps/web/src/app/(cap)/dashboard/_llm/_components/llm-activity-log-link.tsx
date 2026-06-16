"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Text } from "@pekulo/ui/client";
import { Section } from "@pekulo/ui";

// Story 6-5 (FR-36) — navigation entry from settings into the 90-day activity
// log. Grayscale text link (AC-6); the "→" affordance mirrors the ux-preview
// SettingsScreen mock. Routes to /dashboard/parametres/journal-ia (under
// (cap)/dashboard/* so the CapShell layout wraps it, lesson 2026-05-27).
export function LlmActivityLogLink() {
  const t = useTranslations("llm");
  return (
    <Section title={t("activityLogLink.title")} ariaLabel={t("activityLogLink.ariaLabel")}>
      <Link href="/dashboard/parametres/journal-ia" style={{ textDecoration: "none" }}>
        <Text color="$colorSecondary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
          {t("activityLogLink.linkText")}
        </Text>
      </Link>
    </Section>
  );
}
