"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { pekuloFontSizes, useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import {
  loginSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  signupSchema,
} from "@pekulo/validators";
import { signIn, signUp } from "@/app/(auth)/_actions/auth-actions";
import {
  AuthField,
  AuthInput,
  AuthScreen,
  AuthSubmitButton,
  authInputTextStyle,
} from "@/components/auth/auth-shell";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        // AC-1: reject a weak password client-side with the policy message
        // before any Supabase round-trip. The action re-checks server-side.
        const check = signupSchema.safeParse({ email, password });
        if (!check.success) {
          const issue =
            check.error.issues.find((i) => i.path[0] === "password") ?? check.error.issues[0];
          toast.danger("Inscription refusée", issue?.message ?? PASSWORD_POLICY_MESSAGE);
          return;
        }
        const result = await signUp(email, password);
        if (!result.ok) {
          toast.danger("Inscription refusée", result.message);
        } else {
          toast.success("Compte créé", "Vérifie tes emails pour confirmer.");
        }
      } else {
        // Reject empty / malformed credentials client-side before the round-trip
        // (loginSchema: valid email + non-empty password). The action remains
        // the trust boundary (aped-review n6).
        const check = loginSchema.safeParse({ email, password });
        if (!check.success) {
          toast.danger(
            "Connexion refusée",
            check.error.issues[0]?.message ?? "Vérifie tes identifiants.",
          );
          return;
        }
        // Auth runs server-side now: the session is written as an httpOnly
        // cookie the browser cannot read (story 11-7, AC-1). Errors arrive
        // already sanitised from the action.
        const result = await signIn(email, password);
        if (!result.ok) {
          toast.danger("Connexion refusée", result.message);
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
      ariaLabel={isLogin ? "Connexion" : "Inscription"}
      subtitle={isLogin ? "Connecte-toi à ton dashboard" : "Crée ton compte en quelques secondes"}
      footer={
        <Text color="$colorTertiary" fontSize="$caption">
          {isLogin ? (
            <>
              Pas de compte ?{" "}
              <Link href="/signup" style={{ color: "var(--color)", fontWeight: 600 }}>
                S&apos;inscrire
              </Link>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <Link href="/login" style={{ color: "var(--color)", fontWeight: 600 }}>
                Se connecter
              </Link>
            </>
          )}
        </Text>
      }
    >
      <form onSubmit={handleSubmit}>
        <View flexDirection="column" gap="$4">
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
          <AuthField label="Mot de passe" htmlFor="password">
            <AuthInput
              id="password"
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder={isLogin ? "••••••••" : "Au moins 12 caractères"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={isLogin ? 1 : PASSWORD_MIN_LENGTH}
              style={authInputTextStyle}
            />
          </AuthField>
          {isLogin && (
            <View alignItems="flex-end" marginTop={-4}>
              <Link
                href="/recover"
                style={{ color: "var(--colorTertiary)", fontSize: pekuloFontSizes.caption }}
              >
                Mot de passe oublié ?
              </Link>
            </View>
          )}
          <AuthSubmitButton
            type="submit"
            disabled={loading}
            opacity={loading ? 0.6 : 1}
            marginTop="$1"
          >
            {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
            <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
              {isLogin ? "Se connecter" : "Créer un compte"}
            </Text>
          </AuthSubmitButton>
        </View>
      </form>
    </AuthScreen>
  );
}
