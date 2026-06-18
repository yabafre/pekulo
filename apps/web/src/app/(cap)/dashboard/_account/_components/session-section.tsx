// apps/web/src/app/(cap)/dashboard/_account/_components/session-section.tsx
// The « Session » settings section — just the sign-out action. Split out of
// AccountSection so the Paramètres page can place it near the BOTTOM (ux-preview
// SettingsScreen keeps Session second-to-last, before Hypothèse), instead of
// stacking it right under « Compte » at the top.
import { Section } from "@pekulo/ui";
import { SignOutButton } from "./sign-out-button";

export function SessionSection() {
  return (
    <Section ariaLabel="Session">
      <SignOutButton />
    </Section>
  );
}
