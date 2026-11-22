// apps/mobile/app/parametres.tsx
// Mobile Paramètres native iOS form sheet: omits duplicate inline header title
// (owned by native Stack formSheet header), gives account identity + auth CTA
// spacious vertical layout for 375pt iPhones, prompts a native iOS destructive
// confirmation alert before sign-out, and syncs theme & language with
// `useThemeSetting()` and `settingsClient`.

import {
  PekuloButton,
  PekuloSegmentedControl,
  Section,
  useThemeSetting,
  useToast,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import type { LangPref, ThemePref } from "@pekulo/validators";
import { useRouter } from "expo-router";
import Stack from "expo-router/stack";
import { SymbolView } from "expo-symbols";
import { Globe, Monitor, Moon, Sun } from "lucide-react-native";
import { Alert, Platform, Pressable } from "react-native";
import { useTheme } from "tamagui";

import { DestructiveButton, SwitchField } from "../components/form/fields";
import { useMutationRunner } from "../components/form/sheet";
import { ScreenShell } from "../components/screen-shell";
import { useAuth } from "../lib/auth/auth-context";
import { formatCompactEur } from "../lib/format";
import { useDeleteUserAccount, useLlmOptIn } from "../lib/hooks/use-mobile-mutations";
import { useMobileCompassData, useMobileSettingsData } from "../lib/hooks/use-mobile-queries";
import { useI18n } from "../lib/i18n";

function toTamaguiThemeChoice(pref: ThemePref): "pekulo-dark" | "pekulo-light" | "system" {
  if (pref === "dark") return "pekulo-dark";
  if (pref === "light") return "pekulo-light";
  return "system";
}

export default function ParametresScreen() {
  const { isAuthenticated, userEmail, signOut } = useAuth();
  const { prefs, updateTheme, updateLang } = useMobileSettingsData();
  const themeSetting = useThemeSetting();
  const toast = useToast();
  const router = useRouter();
  const theme = useTheme();
  const { data: compass } = useMobileCompassData();
  const llm = useLlmOptIn();
  const deleteAccount = useDeleteUserAccount();
  const { run } = useMutationRunner();
  const { t } = useI18n();

  function handleThirdPartyChange(next: boolean) {
    void run(
      () => llm.setThirdParty(next),
      next ? t("settings.ai.enabled") : t("settings.ai.disabled"),
    );
  }

  function confirmAccountDeletion(typed: string | undefined) {
    const expected = (userEmail ?? "").trim().toLowerCase();
    if (!typed || typed.trim().toLowerCase() !== expected) {
      Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
      return;
    }
    void run(async () => {
      await deleteAccount.mutateAsync({ confirmationEmail: typed.trim() });
      router.replace("/login");
    }, t("settings.deletion.done"));
  }

  function handleDeleteAccount() {
    const message = t("settings.deletion.message", {
      email: userEmail ?? t("settings.deletion.yourEmail"),
    });
    if (Platform.OS === "ios") {
      Alert.prompt(
        t("settings.deletion.title"),
        message,
        [
          { text: t("common.actions.cancel"), style: "cancel" },
          {
            text: t("common.actions.delete"),
            style: "destructive",
            onPress: confirmAccountDeletion,
          },
        ],
        "plain-text",
        "",
        "email-address",
      );
      return;
    }
    Alert.alert(t("settings.deletion.title"), t("settings.deletion.webOnly"));
  }

  const initial = (userEmail?.trim().charAt(0) || "A").toUpperCase();

  async function handleThemeChange(nextTheme: ThemePref) {
    themeSetting.set(toTamaguiThemeChoice(nextTheme));
    try {
      await updateTheme(nextTheme);
    } catch {
      toast.danger(t("settings.appearance.themeSaveFailed"), t("common.errors.saveFailedMessage"));
    }
  }

  async function handleLangChange(nextLang: LangPref) {
    try {
      await updateLang(nextLang);
    } catch {
      toast.danger(t("settings.appearance.langSaveFailed"), t("common.errors.saveFailedMessage"));
    }
  }

  async function executeSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleAuthAction() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    Alert.alert(t("settings.account.signOutTitle"), t("settings.account.signOutMessage"), [
      { text: t("common.actions.cancel"), style: "cancel" },
      {
        text: t("settings.account.signOut"),
        style: "destructive",
        onPress: () => {
          void executeSignOut();
        },
      },
    ]);
  }

  return (
    <ScreenShell>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t("common.actions.closeSettings")}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        >
          {t("common.actions.close")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Section title={t("settings.account.title")} ariaLabel={t("settings.account.aria")}>
        <View gap="$4">
          <View flexDirection="row" alignItems="center" gap="$3">
            <View
              width={44}
              height={44}
              borderRadius="$full"
              backgroundColor="$backgroundMuted"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$color" fontSize="$body" fontWeight="600">
                {initial}
              </Text>
            </View>
            <View flex={1} gap={2}>
              <Text color="$color" fontSize="$body" fontWeight="600" numberOfLines={1} selectable>
                {userEmail ?? t("settings.account.preview")}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                {isAuthenticated ? t("settings.account.synced") : t("settings.account.offline")}
              </Text>
            </View>
          </View>

          <PekuloButton
            variant={isAuthenticated ? "secondary" : "default"}
            size="lg"
            style={{ width: "100%", height: 44, borderCurve: "continuous" }}
            testID="settings-auth-action-btn"
            onPress={handleAuthAction}
          >
            {isAuthenticated ? t("settings.account.signOut") : t("common.actions.signIn")}
          </PekuloButton>
        </View>
      </Section>

      <Section title={t("settings.appearance.title")} ariaLabel={t("settings.appearance.aria")}>
        <View gap="$4">
          <View gap="$2">
            <Text color="$colorSecondary" fontSize="$xs" letterSpacing={0.5}>
              {t("settings.appearance.theme")}
            </Text>
            <PekuloSegmentedControl<ThemePref>
              ariaLabel={t("settings.appearance.themeAria")}
              value={prefs.theme}
              onChange={(val) => {
                void handleThemeChange(val);
              }}
              options={[
                { value: "system", label: t("settings.theme.system"), icon: Monitor },
                { value: "dark", label: t("settings.theme.dark"), icon: Moon },
                { value: "light", label: t("settings.theme.light"), icon: Sun },
              ]}
            />
          </View>

          <View gap="$2">
            <Text color="$colorSecondary" fontSize="$xs" letterSpacing={0.5}>
              {t("settings.appearance.language")}
            </Text>
            <PekuloSegmentedControl<LangPref>
              ariaLabel={t("settings.appearance.languageAria")}
              value={prefs.lang}
              onChange={(val) => {
                void handleLangChange(val);
              }}
              options={[
                { value: "fr", label: t("settings.lang.fr"), icon: Globe },
                { value: "en", label: t("settings.lang.en"), icon: Globe },
              ]}
            />
          </View>
        </View>
      </Section>

      <Section title={t("settings.cap.title")} ariaLabel={t("settings.cap.aria")}>
        <Pressable
          testID="compass-row"
          accessibilityRole="button"
          accessibilityLabel={t("settings.cap.edit")}
          onPress={() => router.push("/sheets/compass")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            minHeight={44}
          >
            <View gap={2}>
              <Text color="$color" fontSize="$body" fontWeight="500">
                {t("settings.cap.objective", {
                  value: compass ? formatCompactEur(compass.objectif) : "—",
                })}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                {t("settings.cap.horizon", {
                  value: compass ? t("settings.cap.years", { count: compass.horizonYears }) : "—",
                })}
              </Text>
            </View>
            <SymbolView
              name="chevron.right"
              size={14}
              weight="semibold"
              tintColor={theme.colorTertiary.val}
              fallback={null}
            />
          </View>
        </Pressable>
      </Section>

      <Section title={t("settings.ai.title")} ariaLabel={t("settings.ai.aria")}>
        <View gap="$2">
          <SwitchField
            label={t("settings.ai.thirdParty")}
            value={llm.thirdParty}
            disabled={llm.isLoading || llm.isSaving}
            onChange={handleThirdPartyChange}
            testID="llm-optin-switch"
          />
          <Text color="$colorTertiary" fontSize="$xs">
            {t("settings.ai.footer")}
          </Text>
        </View>
      </Section>

      {isAuthenticated ? (
        <DestructiveButton
          label={t("settings.deletion.button")}
          testID="delete-account-btn"
          onPress={handleDeleteAccount}
        />
      ) : null}

      <Text color="$colorTertiary" fontSize="$xs" textAlign="center">
        Pekulo · v0.1.0
      </Text>
    </ScreenShell>
  );
}
