"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeSetting } from "@tamagui/next-theme";
import { useTranslations } from "next-intl";
import { PekuloSegmentedControl } from "@pekulo/ui";
import { THEME_VALUES, type ThemePref } from "@pekulo/validators";
import { updateTheme } from "../_actions/settings-actions";

// system → Monitor; dark → Moon; light → Sun. The provider maps each value to
// a data-theme via its `value` map (story 8-2 T14), so `set(v)` applies live.
const ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

export function ThemeControl({ initial }: { initial: ThemePref }) {
  const t = useTranslations("settings");
  const { set, current } = useThemeSetting();
  // `current` is the selected key (system|dark|light) — NOT resolvedTheme,
  // which collapses system→dark|light and would mis-highlight the segment.
  // Falls back to the server pref before next-theme hydrates from localStorage.
  const active = (current as ThemePref | undefined) ?? initial;
  const options = THEME_VALUES.map((v) => ({ value: v, label: t(`theme.${v}`), icon: ICONS[v] }));
  return (
    <PekuloSegmentedControl<ThemePref>
      value={active}
      ariaLabel={t("appearance.theme")}
      options={options}
      onChange={(v) => {
        set(v); // live apply via next-theme (writes localStorage + data-theme)
        void updateTheme({ theme: v }); // persist server-side (AC-6)
      }}
    />
  );
}
