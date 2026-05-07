"use client";

import type { ComponentType } from "react";
import { View, Text, styled } from "tamagui";
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
  { key: "cap", label: "Cap", icon: Compass },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "monthly", label: "Mensuel", icon: LineChart },
  { key: "portfolio", label: "Portefeuille", icon: Wallet },
  { key: "realestate", label: "Immobilier", icon: Building2 },
];

const NavButton = styled(View, {
  name: "PekuloNavRailButton",
  render: "button",
  role: "button",
  width: 44,
  height: 44,
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
      true: { backgroundColor: "$backgroundMuted" },
    },
  } as const,
});

export interface PekuloNavRailProps {
  activeKey: PekuloNavKey;
  onSelect: (key: PekuloNavKey) => void;
}

export function PekuloNavRail({ activeKey, onSelect }: PekuloNavRailProps) {
  return (
    <View
      render="nav"
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
      justifyContent="space-between"
      $max-md={{ display: "none" }}
    >
      <Text color="$color" fontSize={18} fontWeight="600">
        P
      </Text>
      <View flexDirection="column" gap="$2">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={activeKey === key}
            onPress={() => onSelect(key)}
            aria-label={label}
            aria-current={activeKey === key ? "page" : undefined}
          >
            <Icon size={20} color="currentColor" />
          </NavButton>
        ))}
      </View>
      <NavButton
        active={activeKey === "settings"}
        onPress={() => onSelect("settings")}
        aria-label="Paramètres"
        aria-current={activeKey === "settings" ? "page" : undefined}
      >
        <Settings size={20} color="currentColor" />
      </NavButton>
    </View>
  );
}
