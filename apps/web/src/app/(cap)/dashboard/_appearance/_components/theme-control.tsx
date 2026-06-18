"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { PekuloSegmentedControl, useThemeSetting } from "@pekulo/ui";
import { type ThemePref } from "@pekulo/validators";
import { updateTheme } from "../_actions/settings-actions";

// system → Monitor; dark → Moon; light → Sun. The provider maps each value to
// a data-theme via its `value` map (story 8-2 T14), so `set(v)` applies live.
const ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

// DISPLAY order (presentation only) — Système · Sombre · Clair, matching the
// ux-preview SSOT (docs/ux-preview/src/App.tsx:1752-1754). THEME_VALUES stays
// the DB-iso source (order mirrors the Postgres enum); the segmented control
// orders here so display intent is explicit and decoupled from the DB array.
const THEME_ORDER = ["system", "dark", "light"] as const satisfies readonly ThemePref[];

export function ThemeControl({ initial }: { initial: ThemePref }) {
  const t = useTranslations("settings");
  const { set, current } = useThemeSetting();
  // `current` is the selected key (system|dark|light) — NOT resolvedTheme,
  // which collapses system→dark|light and would mis-highlight the segment.
  // Falls back to the server pref before next-theme hydrates from localStorage.
  const active = (current as ThemePref | undefined) ?? initial;
  const options = THEME_ORDER.map((v) => ({ value: v, label: t(`theme.${v}`), icon: ICONS[v] }));
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
