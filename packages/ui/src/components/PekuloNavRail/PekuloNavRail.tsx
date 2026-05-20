"use client";

// packages/ui/src/components/PekuloNavRail.tsx
//
// Mirrors ux-preview `NavRail` (App.tsx:211-269) verbatim:
//   - Compass icon button at top (Pekulo home / "cap" key) — NOT a "P"
//     letter; ux-preview never shipped a letter affordance and the letter
//     created a large vertical gap when paired with `justify-content:
//     space-between`.
//   - Hairline separator below the home button.
//   - Inner `<nav>` packs the 5 nav buttons with `gap-1` and grows
//     (`flex-1`) so the settings button sits at the bottom without
//     needing `space-between` on the outer column.
//
// Visual envelope unchanged: fixed left bubble, `$backgroundCard` fill,
// `$xl` radius, vertical paddingVertical $4.

import type { ComponentType } from "react";
import { View, styled } from "tamagui";
import { Compass, Receipt, LineChart, Wallet, Building2, Settings } from "lucide-react";

export type PekuloNavKey =
  | "cap"
  | "transactions"
  | "monthly"
  | "portfolio"
  | "realestate"
  | "settings";

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

interface NavItem {
  key: PekuloNavKey;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "monthly", label: "Mensuel", icon: LineChart },
  { key: "portfolio", label: "Portefeuille", icon: Wallet },
  { key: "realestate", label: "Immobilier", icon: Building2 },
];

// View-styled doesn't take a `color` prop (color is a text-style prop), so
// active-state icon-colorization is applied via the lucide `color` attribute
// at the call site (see `PekuloNavRail` body — active = `var(--color)`,
// inactive = `var(--colorTertiary)`).
const NavButton = styled(View, {
  name: "PekuloNavRailButton",
  render: "button",
  role: "button",
  width: 40,
  height: 40,
  borderRadius: "$lg",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$backgroundMuted" },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
  variants: {
    active: {
      true: { backgroundColor: "$backgroundElevated" },
    },
  } as const,
});

function iconColor(active: boolean): string {
  return active ? "var(--color)" : "var(--colorTertiary)";
}

export interface PekuloNavRailProps {
  activeKey: PekuloNavKey;
  onSelect: (key: PekuloNavKey) => void;
}

export function PekuloNavRail({ activeKey, onSelect }: PekuloNavRailProps) {
  return (
    <View
      render="aside"
      aria-label="Navigation principale"
      position="fixed"
      left="$4"
      top="$4"
      bottom="$4"
      width="$16"
      backgroundColor="$backgroundCard"
      borderRadius="$xl"
      paddingVertical="$4"
      flexDirection="column"
      alignItems="center"
      gap="$1"
      $max-lg={{ display: "none" }}
    >
      <NavButton
        active={activeKey === "cap"}
        onPress={() => onSelect("cap")}
        aria-label="Pekulo — accueil"
        aria-current={activeKey === "cap" ? "page" : undefined}
      >
        <Compass size={22} color={iconColor(activeKey === "cap")} />
      </NavButton>
      <View marginVertical="$2" height={1} width={32} backgroundColor="$borderDefault" />
      <View render="nav" flexDirection="column" gap="$1" flex={1}>
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={activeKey === key}
            onPress={() => onSelect(key)}
            aria-label={label}
            aria-current={activeKey === key ? "page" : undefined}
          >
            <Icon size={18} color={iconColor(activeKey === key)} />
          </NavButton>
        ))}
      </View>
      <NavButton
        active={activeKey === "settings"}
        onPress={() => onSelect("settings")}
        aria-label="Paramètres"
        aria-current={activeKey === "settings" ? "page" : undefined}
      >
        <Settings size={18} color={iconColor(activeKey === "settings")} />
      </NavButton>
    </View>
  );
}
