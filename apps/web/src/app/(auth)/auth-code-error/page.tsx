// apps/web/src/app/(auth)/auth-code-error/page.tsx
// Terminal page for a failed auth code exchange — the callback (route.ts)
// redirects here when exchangeCodeForSession errors or the code is missing.
// Static, public, no session needed. Shares the TR-strict AuthScreen shell so
// it matches login / signup / recover (story 8-1 visual refonte).
import type { CSSProperties } from "react";
import Link from "next/link";
import { pekuloFontSizes } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { AuthScreen } from "@/components/auth/auth-shell";

// Primary CTA styled as the white pill (a Link, not a form button).
const primaryCta: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: 48,
  borderRadius: 9999,
  background: "var(--color)",
  color: "var(--colorOnAccent)",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 600,
  textDecoration: "none",
};

export default function AuthCodeErrorPage() {
  return (
    <AuthScreen
      ariaLabel="Lien invalide"
      subtitle="Lien d'authentification"
      footer={
        <Text color="$colorTertiary" fontSize="$caption">
          <Link href="/login" style={{ color: "var(--color)", fontWeight: 600 }}>
            Retour à la connexion
          </Link>
        </Text>
      }
    >
      <View flexDirection="column" gap="$5" alignItems="center">
        <View flexDirection="column" gap="$2" alignItems="center">
          <Text color="$color" fontSize="$h2" fontWeight="600" textAlign="center">
            Lien invalide ou expiré
          </Text>
          <Text color="$colorSecondary" fontSize="$bodySm" textAlign="center">
            Ce lien d&apos;authentification n&apos;est plus valide. Demande un nouveau lien pour
            continuer.
          </Text>
        </View>
        <Link href="/recover" style={primaryCta}>
          Demander un nouveau lien
        </Link>
      </View>
    </AuthScreen>
  );
}
