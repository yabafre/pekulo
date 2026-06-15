"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Section, pekuloFontSizes, useToast } from "@pekulo/ui";
import { Text, View, styled } from "@pekulo/ui/client";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  passwordResetRequestSchema,
  passwordUpdateSchema,
} from "@pekulo/validators";
import { requestPasswordReset, updatePassword } from "@/app/(auth)/_actions/auth-actions";

const Input = styled.input({
  backgroundColor: "$backgroundMuted",
  borderRadius: "$md",
  paddingHorizontal: "$3",
  paddingVertical: 10,
  borderWidth: 0,
});

const SubmitButton = styled.button({
  backgroundColor: "$color",
  borderRadius: "$full",
  paddingHorizontal: "$4",
  paddingVertical: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  cursor: "pointer",
  borderWidth: 0,
  pressStyle: { scale: 0.98 },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
  marginTop: "$1",
});

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
    <View minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
      <View width="100%" maxWidth={420}>
        <Section ariaLabel={isRequest ? "Réinitialiser le mot de passe" : "Nouveau mot de passe"}>
          <View alignItems="center" gap="$1" marginBottom="$4">
            <Text color="$color" fontSize="$h2" fontWeight="600">
              Pekulo
            </Text>
            <Text color="$colorSecondary" fontSize="$caption">
              {isRequest
                ? "Reçois un lien de réinitialisation"
                : "Choisis ton nouveau mot de passe"}
            </Text>
          </View>
          <form onSubmit={handleSubmit}>
            <View flexDirection="column" gap="$3">
              {isRequest ? (
                <View flexDirection="column" gap={6}>
                  <Text
                    color="$color"
                    fontSize="$caption"
                    fontWeight="500"
                    render="label"
                    htmlFor="email"
                  >
                    Email
                  </Text>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="jean@exemple.fr"
                    required
                    style={{
                      color: "var(--color)",
                      fontSize: pekuloFontSizes.bodySm,
                      outline: "none",
                    }}
                  />
                </View>
              ) : (
                <View flexDirection="column" gap={6}>
                  <Text
                    color="$color"
                    fontSize="$caption"
                    fontWeight="500"
                    render="label"
                    htmlFor="new-password"
                  >
                    Nouveau mot de passe
                  </Text>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    style={{
                      color: "var(--color)",
                      fontSize: pekuloFontSizes.bodySm,
                      outline: "none",
                    }}
                  />
                </View>
              )}
              <SubmitButton type="submit" disabled={loading}>
                {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
                <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
                  {isRequest ? "Envoyer le lien" : "Mettre à jour"}
                </Text>
              </SubmitButton>
            </View>
          </form>
          <View alignItems="center" marginTop="$4">
            <Text color="$colorTertiary" fontSize="$caption">
              <Link href="/login" style={{ color: "var(--color)" }}>
                Retour à la connexion
              </Link>
            </Text>
          </View>
        </Section>
      </View>
    </View>
  );
}
