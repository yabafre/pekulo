"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
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
          toast.danger(t("signUp.rejected"), issue?.message ?? PASSWORD_POLICY_MESSAGE);
          return;
        }
        const result = await signUp(email, password);
        if (!result.ok) {
          toast.danger(t("signUp.rejected"), result.message);
        } else {
          toast.success(t("signUp.created"), t("signUp.checkEmails"));
        }
      } else {
        // Reject empty / malformed credentials client-side before the round-trip
        // (loginSchema: valid email + non-empty password). The action remains
        // the trust boundary (aped-review n6).
        const check = loginSchema.safeParse({ email, password });
        if (!check.success) {
          toast.danger(
            t("signIn.rejected"),
            check.error.issues[0]?.message ?? t("signIn.checkCredentials"),
          );
          return;
        }
        // Auth runs server-side now: the session is written as an httpOnly
        // cookie the browser cannot read (story 11-7, AC-1). Errors arrive
        // already sanitised from the action.
        const result = await signIn(email, password);
        if (!result.ok) {
          toast.danger(t("signIn.rejected"), result.message);
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
      ariaLabel={isLogin ? t("signIn.title") : t("signUp.title")}
      subtitle={isLogin ? t("signIn.subtitle") : t("signUp.subtitle")}
      footer={
        <Text color="$colorTertiary" fontSize="$caption">
          {isLogin ? (
            <>
              {t("signIn.noAccount")}{" "}
              <Link href="/signup" style={{ color: "var(--color)", fontWeight: 600 }}>
                {t("signIn.signUpLink")}
              </Link>
            </>
          ) : (
            <>
              {t("signUp.haveAccount")}{" "}
              <Link href="/login" style={{ color: "var(--color)", fontWeight: 600 }}>
                {t("signUp.signInLink")}
              </Link>
            </>
          )}
        </Text>
      }
    >
      <form onSubmit={handleSubmit}>
        <View flexDirection="column" gap="$4">
          <AuthField label={t("fields.email")} htmlFor="email">
            <AuthInput
              id="email"
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder={t("fields.emailPlaceholder")}
              autoComplete="email"
              required
              style={authInputTextStyle}
            />
          </AuthField>
          <AuthField label={t("fields.password")} htmlFor="password">
            <AuthInput
              id="password"
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder={isLogin ? "••••••••" : t("fields.passwordHint")}
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
                {t("signIn.forgotPassword")}
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
              {isLogin ? t("signIn.submit") : t("signUp.submit")}
            </Text>
          </AuthSubmitButton>
        </View>
      </form>
    </AuthScreen>
  );
}
