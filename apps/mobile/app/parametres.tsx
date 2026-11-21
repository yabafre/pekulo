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

  function handleThirdPartyChange(next: boolean) {
    void run(
      () => llm.setThirdParty(next),
      next ? "Modèles IA tiers activés" : "Modèles IA tiers désactivés",
    );
  }

  function confirmAccountDeletion(typed: string | undefined) {
    const expected = (userEmail ?? "").trim().toLowerCase();
    if (!typed || typed.trim().toLowerCase() !== expected) {
      Alert.alert("E-mail incorrect", "Saisissez exactement l’adresse e-mail de votre compte.");
      return;
    }
    void run(async () => {
      await deleteAccount.mutateAsync({ confirmationEmail: typed.trim() });
      router.replace("/login");
    }, "Compte supprimé");
  }

  function handleDeleteAccount() {
    const message = `Toutes vos données seront définitivement effacées. Saisissez ${userEmail ?? "votre e-mail"} pour confirmer.`;
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Supprimer mon compte ?",
        message,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: confirmAccountDeletion },
        ],
        "plain-text",
        "",
        "email-address",
      );
      return;
    }
    Alert.alert("Supprimer mon compte ?", "Supprimez votre compte depuis l’espace web Pekulo.");
  }

  const initial = (userEmail?.trim().charAt(0) || "A").toUpperCase();

  async function handleThemeChange(nextTheme: ThemePref) {
    themeSetting.set(toTamaguiThemeChoice(nextTheme));
    try {
      await updateTheme(nextTheme);
    } catch {
      toast.danger("Préférence non enregistrée", "Vérifiez votre connexion puis réessayez.");
    }
  }

  async function handleLangChange(nextLang: LangPref) {
    try {
      await updateLang(nextLang);
    } catch {
      toast.danger("Langue non enregistrée", "Vérifiez votre connexion puis réessayez.");
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
    Alert.alert(
      "Se déconnecter ?",
      "Votre session sera supprimée de cet appareil et le cache local sera effacé.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: () => {
            void executeSignOut();
          },
        },
      ],
    );
  }

  return (
    <ScreenShell>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Fermer les paramètres"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        >
          Fermer
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Section title="Compte" ariaLabel="Compte utilisateur">
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
                {userEmail ?? "Mode aperçu"}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                {isAuthenticated ? "Synchronisé via Supabase" : "Session locale hors connexion"}
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
            {isAuthenticated ? "Se déconnecter" : "Se connecter"}
          </PekuloButton>
        </View>
      </Section>

      <Section title="Apparence" ariaLabel="Apparence et langue">
        <View gap="$4">
          <View gap="$2">
            <Text color="$colorSecondary" fontSize="$xs" letterSpacing={0.5}>
              THÈME
            </Text>
            <PekuloSegmentedControl<ThemePref>
              ariaLabel="Thème de l'application"
              value={prefs.theme}
              onChange={(val) => {
                void handleThemeChange(val);
              }}
              options={[
                { value: "system", label: "Système", icon: Monitor },
                { value: "dark", label: "Sombre", icon: Moon },
                { value: "light", label: "Clair", icon: Sun },
              ]}
            />
          </View>

          <View gap="$2">
            <Text color="$colorSecondary" fontSize="$xs" letterSpacing={0.5}>
              LANGUE
            </Text>
            <PekuloSegmentedControl<LangPref>
              ariaLabel="Langue de l'application"
              value={prefs.lang}
              onChange={(val) => {
                void handleLangChange(val);
              }}
              options={[
                { value: "fr", label: "Français", icon: Globe },
                { value: "en", label: "English", icon: Globe },
              ]}
            />
          </View>
        </View>
      </Section>

      <Section title="Cap" ariaLabel="Objectif et horizon du cap">
        <Pressable
          testID="compass-row"
          accessibilityRole="button"
          accessibilityLabel="Modifier mon cap"
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
                Objectif {compass ? formatCompactEur(compass.objectif) : "—"}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                Horizon {compass ? `${compass.horizonYears} ans` : "—"}
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

      <Section title="Intelligence artificielle" ariaLabel="Préférences IA">
        <View gap="$2">
          <SwitchField
            label="Modèles IA tiers"
            value={llm.thirdParty}
            disabled={llm.isLoading || llm.isSaving}
            onChange={handleThirdPartyChange}
            testID="llm-optin-switch"
          />
          <Text color="$colorTertiary" fontSize="$xs">
            Autorise l’envoi de libellés anonymisés à un fournisseur tiers pour suggérer les
            catégories. Désactivé, seul le modèle local est utilisé.
          </Text>
        </View>
      </Section>

      {isAuthenticated ? (
        <DestructiveButton
          label="Supprimer mon compte"
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
