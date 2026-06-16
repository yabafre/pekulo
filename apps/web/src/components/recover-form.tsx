"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
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
          toast.danger(t("emailInvalid"), t("recover.emailInvalidDesc"));
          return;
        }
        await requestPasswordReset(email);
        // Enumeration-safe confirmation — never reveal whether the account exists.
        toast.success(t("recover.emailSentTitle"), t("recover.emailSentDesc"));
      } else {
        const check = passwordUpdateSchema.safeParse({ password });
        if (!check.success) {
          toast.danger(
            t("recover.passwordTooShortTitle"),
            check.error.issues[0]?.message ?? PASSWORD_POLICY_MESSAGE,
          );
          return;
        }
        const result = await updatePassword(password);
        if (!result.ok) {
          toast.danger(t("recover.failTitle"), result.message);
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
      ariaLabel={isRequest ? t("recover.requestTitle") : t("recover.resetTitle")}
      subtitle={isRequest ? t("recover.requestSubtitle") : t("recover.resetSubtitle")}
      footer={
        <Text color="$colorTertiary" fontSize="$caption">
          <Link href="/login" style={{ color: "var(--color)", fontWeight: 600 }}>
            {t("recover.backToLogin")}
          </Link>
        </Text>
      }
    >
      <form onSubmit={handleSubmit}>
        <View flexDirection="column" gap="$4">
          {isRequest ? (
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
          ) : (
            <AuthField label={t("fields.newPassword")} htmlFor="new-password">
              <AuthInput
                id="new-password"
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder={t("fields.passwordHint")}
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
              {isRequest ? t("recover.sendLink") : t("recover.update")}
            </Text>
          </AuthSubmitButton>
        </View>
      </form>
    </AuthScreen>
  );
}
