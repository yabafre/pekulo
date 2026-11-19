// apps/mobile/app/parametres.tsx
// Mobile Paramètres modal: displays account identity, sign-in / sign-out action,
// theme & language segmented controls synced with `useThemeSetting()` and
// `settingsClient` (`useMobileSettingsData()`), plus Design System status.

import {
  PekuloButton,
  PekuloSegmentedControl,
  PekuloSettingRow,
  PekuloStat,
  Section,
  useThemeSetting,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import type { LangPref, ThemePref } from "@pekulo/validators";
import { useRouter } from "expo-router";
import { Globe, Monitor, Moon, Sun } from "lucide-react-native";

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
  const router = useRouter();

  async function handleThemeChange(nextTheme: ThemePref) {
    themeSetting.set(toTamaguiThemeChoice(nextTheme));
    await updateTheme(nextTheme);
  }

  async function handleLangChange(nextLang: LangPref) {
    await updateLang(nextLang);
  }

  async function handleAuthAction() {
    if (isAuthenticated) {
      await signOut();
      router.replace("/login");
    } else {
      router.push("/login");
    }
  }

  return (
    <ScreenShell title="Paramètres" subtitle="Apparence, compte et préférences">
      <Section title="Compte" ariaLabel="Compte utilisateur">
        <PekuloSettingRow
          label="Session"
          value={userEmail ?? "Mode aperçu"}
          sub={isAuthenticated ? "Synchronisé via Supabase" : "Non connecté"}
          action={
            <PekuloButton
              testID="settings-auth-action-btn"
              onPress={() => {
                void handleAuthAction();
              }}
            >
              {isAuthenticated ? "Se déconnecter" : "Se connecter"}
            </PekuloButton>
          }
        />
      </Section>

      <Section title="Apparence" ariaLabel="Apparence et langue">
        <View gap="$4">
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
      </Section>

      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Design System" value="Pekulo Tamagui v2" />
      </View>
    </ScreenShell>
  );
}
