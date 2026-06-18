// apps/web/src/app/(cap)/dashboard/_account/_components/account-section.tsx
// FR-46/FR-47. Server Component: reads the authenticated user's email behind
// the auth guard. Mirrors the authoritative ux-preview SettingsScreen (App.tsx):
// the email sits in the « Compte » section at the TOP. Sign-out lives in its
// own « Session » section (SessionSection) placed near the BOTTOM of the
// Paramètres column — ux-preview keeps Session second-to-last (before
// Hypothèse), NOT adjacent to Compte.
import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { createClient } from "@/lib/supabase/server";

export async function AccountSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "—";

  return (
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
  );
}
