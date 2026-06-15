// apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx
// FR-46/FR-47 interim surface (the full Settings screen lands in story 8-2).
// Server Component: reads the authenticated user's email behind the auth guard.
// Mirrors the authoritative ux-preview SettingsScreen (App.tsx): the email sits
// in a « Compte » section, logout in a separate « Session » section — the two
// stack as direct children of the Paramètres column so they inherit its gap
// (aped-review m5).
import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export async function AccountSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "—";

  return (
    <>
      <Section ariaLabel="Compte">
        <View flexDirection="column" gap={2}>
          <Text color="$colorTertiary" fontSize="$caption">
            Compte
          </Text>
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {email}
          </Text>
        </View>
      </Section>
      <Section ariaLabel="Session">
        <SignOutButton />
      </Section>
    </>
  );
}
