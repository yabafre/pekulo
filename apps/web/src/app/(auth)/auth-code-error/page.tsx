// apps/web/src/app/(auth)/auth-code-error/page.tsx
// Terminal page for a failed auth code exchange — the callback (route.ts)
// redirects here when exchangeCodeForSession errors or the code is missing.
// Static, public, no session needed. Offers a path back to login / recover.
import Link from "next/link";
import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

export default function AuthCodeErrorPage() {
  return (
    <View minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
      <View width="100%" maxWidth={420}>
        <Section ariaLabel="Lien invalide">
          <View alignItems="center" gap="$2">
            <Text color="$color" fontSize="$h2" fontWeight="600">
              Lien invalide ou expiré
            </Text>
            <Text color="$colorSecondary" fontSize="$caption" textAlign="center">
              Ce lien d'authentification n'est plus valide. Demande un nouveau lien.
            </Text>
            <View flexDirection="row" gap="$4" marginTop="$3">
              <Link href="/login" style={{ color: "var(--color)" }}>
                Connexion
              </Link>
              <Link href="/recover" style={{ color: "var(--color)" }}>
                Réinitialiser
              </Link>
            </View>
          </View>
        </Section>
      </View>
    </View>
  );
}
