"use client";

// packages/ui/src/components/PekuloMobileBottomNav.tsx
//
// Mobile + tablet bottom nav — visible below Pekulo Tamagui md (= 1020 px),
// hidden on lg+ where `PekuloNavRail` takes over. Mirrors ux-preview
// `App.tsx:180-202`: fixed bottom, 5 icons (Cap/Transactions/Mensuel/
// Portefeuille/Immobilier), max-w md centred, no top border (TR-strict).

import type { ComponentType } from "react";
import { View, Text } from "tamagui";
import { Compass, Receipt, LineChart, Wallet, Building2 } from "lucide-react";
import type { PekuloNavKey } from "./PekuloNavRail";

type LucideIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

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

function iconColor(active: boolean): string {
  return active ? "var(--color)" : "var(--colorTertiary)";
}

export interface PekuloMobileBottomNavProps {
  activeKey: PekuloNavKey;
  onSelect: (key: PekuloNavKey) => void;
}

export function PekuloMobileBottomNav({ activeKey, onSelect }: PekuloMobileBottomNavProps) {
  return (
    <View
      render="nav"
      aria-label="Navigation principale"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={50}
      backgroundColor="$background"
      $md={{ display: "none" }}
    >
      <View
        maxWidth={448}
        marginHorizontal="auto"
        flexDirection="row"
        paddingHorizontal="$2"
        paddingTop="$2"
        paddingBottom="$5"
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeKey === key;
          return (
            <View
              key={key}
              render="button"
              onPress={() => onSelect(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              flex={1}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap="$1"
              paddingVertical="$2"
              borderRadius="$md"
              backgroundColor="transparent"
              borderWidth={0}
              cursor="pointer"
            >
              <Icon size={20} strokeWidth={1.75} color={iconColor(active)} />
              <Text
                fontSize={11}
                lineHeight={11}
                color={active ? "$color" : "$colorTertiary"}
                fontWeight="500"
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
