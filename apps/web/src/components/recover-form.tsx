"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  passwordResetRequestSchema,
  passwordUpdateSchema,
} from "@pekulo/validators";
import { requestPasswordReset, updatePassword } from "@/app/(auth)/_actions/auth-actions";
import {
  AuthField,
  AuthInput,
  AuthScreen,
  AuthSubmitButton,
  authInputTextStyle,
} from "@/components/auth/auth-shell";

export function RecoverForm({ mode }: { mode: "request" | "reset" }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isRequest = mode === "request";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRequest) {
        const check = passwordResetRequestSchema.safeParse({ email });
        if (!check.success) {
          toast.danger("Email invalide", "Vérifie ton adresse email.");
          return;
        }
        await requestPasswordReset(email);
        // Enumeration-safe confirmation — never reveal whether the account exists.
        toast.success(
          "Email envoyé",
          "Si un compte existe, un lien de réinitialisation t'a été envoyé.",
        );
      } else {
        const check = passwordUpdateSchema.safeParse({ password });
        if (!check.success) {
          toast.danger(
            "Mot de passe trop court",
            check.error.issues[0]?.message ?? PASSWORD_POLICY_MESSAGE,
          );
          return;
        }
        const result = await updatePassword(password);
        if (!result.ok) {
          toast.danger("Échec", result.message);
        } else {
          router.push("/dashboard");
          router.refresh();
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      ariaLabel={isRequest ? "Réinitialiser le mot de passe" : "Nouveau mot de passe"}
      subtitle={
        isRequest ? "Reçois un lien de réinitialisation" : "Choisis ton nouveau mot de passe"
      }
      footer={
        <Text color="$colorTertiary" fontSize="$caption">
          <Link href="/login" style={{ color: "var(--color)", fontWeight: 600 }}>
            Retour à la connexion
          </Link>
        </Text>
      }
    >
      <form onSubmit={handleSubmit}>
        <View flexDirection="column" gap="$4">
          {isRequest ? (
            <AuthField label="Email" htmlFor="email">
              <AuthInput
                id="email"
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="jean@exemple.fr"
                autoComplete="email"
                required
                style={authInputTextStyle}
              />
            </AuthField>
          ) : (
            <AuthField label="Nouveau mot de passe" htmlFor="new-password">
              <AuthInput
                id="new-password"
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Au moins 12 caractères"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                style={authInputTextStyle}
              />
            </AuthField>
          )}
          <AuthSubmitButton
            type="submit"
            disabled={loading}
            opacity={loading ? 0.6 : 1}
            marginTop="$1"
          >
            {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
            <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
              {isRequest ? "Envoyer le lien" : "Mettre à jour"}
            </Text>
          </AuthSubmitButton>
        </View>
      </form>
    </AuthScreen>
  );
}
