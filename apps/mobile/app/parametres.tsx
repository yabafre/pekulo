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
import { Globe, Monitor, Moon, Sun } from "lucide-react-native";
import { Alert } from "react-native";

import { ScreenShell } from "../components/screen-shell";
import { useAuth } from "../lib/auth/auth-context";
import { useMobileSettingsData } from "../lib/hooks/use-mobile-queries";

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
            <View flex={1} gap="$0.5">
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
            style={{ width: "100%" }}
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

      <Text color="$colorTertiary" fontSize="$xs" textAlign="center">
        Pekulo · v0.1.0
      </Text>
    </ScreenShell>
  );
}
