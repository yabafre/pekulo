"use client";

// packages/ui/src/components/PekuloMobileBottomNav.tsx
//
// Mobile + tablet bottom nav — visible below Pekulo Tamagui lg (= 1024 px),
// hidden on lg+ where `PekuloNavRail` takes over. Mirrors ux-preview
// `App.tsx:180-202`: fixed bottom, 5 icons (Cap/Transactions/Mensuel/
// Portefeuille/Immobilier), max-w md centred, no top border (TR-strict).
//
// 5 equal columns via CSS grid — flex with flex=1 rounded unevenly and
// pushed the 12-char labels ("Transactions", "Portefeuille") over the
// button edge.

import type { ComponentType } from "react";
import { View, Text } from "tamagui";
import { Compass, Receipt, LineChart, Wallet, Building2 } from "lucide-react";
import type { PekuloNavKey } from "../PekuloNavRail";
import { pekuloSpacing } from "../../tokens";

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
      aria-label="Navigation rapide"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={50}
      backgroundColor="$background"
      $lg={{ display: "none" }}
    >
      <View
        maxWidth={448}
        marginHorizontal="auto"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          paddingTop: pekuloSpacing[2],
          paddingBottom: pekuloSpacing[5],
          paddingLeft: pekuloSpacing[2],
          paddingRight: pekuloSpacing[2],
        }}
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
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={4}
              paddingVertical="$2"
              borderRadius="$md"
              backgroundColor="transparent"
              borderWidth={0}
              cursor="pointer"
              width="100%"
            >
              <Icon size={20} strokeWidth={1.75} color={iconColor(active)} />
              <Text
                fontSize="$11"
                lineHeight={12}
                color={active ? "$color" : "$colorTertiary"}
                fontWeight="500"
                style={{
                  whiteSpace: "nowrap",
                  letterSpacing: -0.1,
                  textAlign: "center",
                }}
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
