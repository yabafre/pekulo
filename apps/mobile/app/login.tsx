// apps/mobile/app/login.tsx
// Mobile sign-in screen (FR-46, NFR-11 12-char password policy). Consumes
// @pekulo/ui native form primitives (PekuloInput, PekuloLabel, PekuloSubmitButton)
// and `useAuth().signInWithPassword`.

import { PekuloInput, PekuloLabel, PekuloSubmitButton } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { useState } from "react";

import { ScreenShell } from "../components/screen-shell";
import { useAuth } from "../lib/auth/auth-context";

export default function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword(email, password);
      if (!result.ok) {
        setErrorMessage(result.errorMessage ?? "Impossible de se connecter.");
        return;
      }
      router.replace("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenShell
      title="Connexion"
      subtitle="Connectez-vous à votre compte Pekulo pour synchroniser votre cap"
    >
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <View gap="$2">
          <PekuloLabel htmlFor="login-email">Adresse e-mail</PekuloLabel>
          <PekuloInput
            id="login-email"
            testID="login-email-input"
            aria-label="Adresse e-mail"
            type="email"
            placeholder="alex@pekulo.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </View>

        <View gap="$2">
          <PekuloLabel htmlFor="login-password">Mot de passe</PekuloLabel>
          <PekuloInput
            id="login-password"
            testID="login-password-input"
            aria-label="Mot de passe"
            type="password"
            placeholder="12 caractères minimum"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </View>

        {errorMessage !== null && (
          <Text color="$danger" fontSize="$bodySm" testID="login-error-msg">
            {errorMessage}
          </Text>
        )}

        <PekuloSubmitButton
          testID="login-submit-btn"
          loading={isSubmitting}
          loadingLabel="Connexion…"
          fullWidth
          onPress={() => {
            void handleSubmit();
          }}
        >
          Se connecter
        </PekuloSubmitButton>
      </View>
    </ScreenShell>
  );
}
