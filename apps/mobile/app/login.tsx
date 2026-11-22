// apps/mobile/app/login.tsx
// Mobile sign-in screen (FR-46, NFR-11 12-char password policy). Follows Apple
// HIG and mobile form ergonomics: native ScrollView keyboard insets
// (`automaticallyAdjustKeyboardInsets`), interactive scroll dismissal, iOS
// autofill (`textContentType`/`autoComplete`), Next → Done return-key chaining,
// immediate error revalidation on edit, and a preview-mode escape hatch when
// auth enforcement is inactive.

import { PekuloButton, PekuloInput, PekuloLabel, PekuloSubmitButton } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { Compass } from "lucide-react-native";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import { useTheme } from "tamagui";

import { ScreenShell } from "../components/screen-shell";
import { useAuth } from "../lib/auth/auth-context";
import { useI18n } from "../lib/i18n";

export default function LoginScreen() {
  const { signInWithPassword, requireAuth } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword(email, password);
      if (!result.ok) {
        setErrorMessage(result.errorMessage ?? t("auth.errors.generic"));
        return;
      }
      router.replace("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenShell respectTopSafeArea>
      <View gap="$3" paddingTop="$6">
        <View
          width={48}
          height={48}
          borderRadius="$lg"
          backgroundColor="$backgroundCard"
          alignItems="center"
          justifyContent="center"
          style={{ borderCurve: "continuous" }}
        >
          <Compass size={24} color={theme.color.val} />
        </View>
        <View gap="$1">
          <Text color="$color" fontSize="$h1" fontWeight="600">
            {t("auth.title")}
          </Text>
          <Text color="$colorSecondary" fontSize="$bodySm">
            {t("auth.subtitle")}
          </Text>
        </View>
      </View>

      <View
        backgroundColor="$backgroundCard"
        borderRadius="$xl"
        padding="$5"
        gap="$4"
        style={{ borderCurve: "continuous" }}
      >
        <View gap="$2">
          <PekuloLabel htmlFor="login-email">{t("auth.email")}</PekuloLabel>
          <PekuloInput
            id="login-email"
            testID="login-email-input"
            aria-label={t("auth.email")}
            type="email"
            placeholder="alex@pekulo.app"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            returnKeyType="next"
            blurOnSubmit={false}
            invalid={errorMessage !== null && !email.includes("@")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onSubmitEditing={() => {
              passwordRef.current?.focus();
            }}
          />
        </View>

        <View gap="$2">
          <PekuloLabel htmlFor="login-password">{t("auth.password")}</PekuloLabel>
          <PekuloInput
            ref={passwordRef}
            id="login-password"
            testID="login-password-input"
            aria-label={t("auth.password")}
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            invalid={errorMessage !== null}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />
        </View>

        {errorMessage !== null && (
          <Text
            color="$danger"
            fontSize="$bodySm"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            selectable
            testID="login-error-msg"
          >
            {errorMessage}
          </Text>
        )}

        <PekuloSubmitButton
          testID="login-submit-btn"
          loading={isSubmitting}
          loadingLabel={t("auth.submitting")}
          fullWidth
          onPress={() => {
            void handleSubmit();
          }}
        >
          {t("common.actions.signIn")}
        </PekuloSubmitButton>
      </View>

      {!requireAuth && (
        <PekuloButton
          variant="ghost"
          size="lg"
          style={{ width: "100%", height: 44 }}
          testID="login-preview-btn"
          onPress={() => {
            router.replace("/");
          }}
        >
          {t("auth.continuePreview")}
        </PekuloButton>
      )}
    </ScreenShell>
  );
}
