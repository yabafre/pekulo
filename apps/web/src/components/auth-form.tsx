"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Section, pekuloFontSizes, useToast } from "@pekulo/ui";
import { Text, View, styled } from "@pekulo/ui/client";
import { createClient } from "@/lib/supabase/client";

// Plain styled HTML input. `color` and `outline` are CSS-only (not in
// Tamagui's StackStyle), so we apply them via inline style referencing
// the theme CSS vars (--color, --borderFocus).
// Plain styled HTML input. Text-style props (color, fontSize, outline)
// are not in Tamagui's StackStyle so they are applied via inline `style`
// referencing the theme CSS vars (--color, --borderFocus).
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

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.danger("Inscription refusée", error.message);
        } else {
          toast.success("Compte créé", "Vérifie tes emails pour confirmer.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Never echo raw Supabase error messages — they can leak rate-limit
          // hints / server details. Surface "Invalid login credentials"
          // explicitly (UX); collapse every other error to a generic line.
          const friendly =
            error.message === "Invalid login credentials"
              ? "Email ou mot de passe incorrect"
              : "Connexion impossible. Réessaie plus tard.";
          toast.danger("Connexion refusée", friendly);
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
        <Section ariaLabel={mode === "login" ? "Connexion" : "Inscription"}>
          <View alignItems="center" gap="$1" marginBottom="$4">
            <Text color="$color" fontSize="$h2" fontWeight="600">
              Pekulo
            </Text>
            <Text color="$colorSecondary" fontSize="$caption">
              {mode === "login" ? "Connecte-toi à ton dashboard" : "Crée ton compte"}
            </Text>
          </View>
          <form onSubmit={handleSubmit}>
            <View flexDirection="column" gap="$3">
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
              <View flexDirection="column" gap={6}>
                <Text
                  color="$color"
                  fontSize="$caption"
                  fontWeight="500"
                  render="label"
                  htmlFor="password"
                >
                  Mot de passe
                </Text>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{
                    color: "var(--color)",
                    fontSize: pekuloFontSizes.bodySm,
                    outline: "none",
                  }}
                />
              </View>
              <SubmitButton type="submit" disabled={loading}>
                {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
                <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
                  {mode === "login" ? "Se connecter" : "Créer un compte"}
                </Text>
              </SubmitButton>
            </View>
          </form>
          <View alignItems="center" marginTop="$4">
            <Text color="$colorTertiary" fontSize="$caption">
              {mode === "login" ? (
                <>
                  Pas de compte ?{" "}
                  <Link href="/auth/signup" style={{ color: "var(--color)" }}>
                    S'inscrire
                  </Link>
                </>
              ) : (
                <>
                  Déjà un compte ?{" "}
                  <Link href="/auth/login" style={{ color: "var(--color)" }}>
                    Se connecter
                  </Link>
                </>
              )}
            </Text>
          </View>
        </Section>
      </View>
    </View>
  );
}
