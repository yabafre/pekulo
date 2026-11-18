// packages/ui/src/components/PekuloNavRail/PekuloNavRail.native.tsx
import type { ComponentType } from "react";
import { Building2, Compass, LineChart, Receipt, Settings, Wallet } from "lucide-react-native";
import { View, styled, useTheme } from "tamagui";

export type PekuloNavKey =
  | "cap"
  | "transactions"
  | "monthly"
  | "portfolio"
  | "realestate"
  | "settings";

type IconComponent = ComponentType<{ size?: number; color?: string }>;

interface NavItem {
  key: PekuloNavKey;
  label: string;
  icon: IconComponent;
}

const NAV_ITEMS: NavItem[] = [
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "monthly", label: "Mensuel", icon: LineChart },
  { key: "portfolio", label: "Portefeuille", icon: Wallet },
  { key: "realestate", label: "Immobilier", icon: Building2 },
];

const NavButton = styled(View, {
  name: "PekuloNavRailButton",
  role: "button",
  width: 40,
  height: 40,
  borderRadius: "$lg",
  alignItems: "center",
  justifyContent: "center",
  pressStyle: { backgroundColor: "$backgroundMuted" },
  variants: {
    active: {
      true: { backgroundColor: "$backgroundElevated" },
    },
  } as const,
});

export interface PekuloNavRailProps {
  activeKey: PekuloNavKey | null;
  onSelect: (key: PekuloNavKey) => void;
}

export function PekuloNavRail({ activeKey, onSelect }: PekuloNavRailProps) {
  const theme = useTheme();
  const iconColor = (active: boolean) => (active ? theme.color.val : theme.colorTertiary.val);

  return (
    <View
      aria-label="Navigation principale"
      width={64}
      backgroundColor="$backgroundCard"
      borderRadius="$xl"
      paddingVertical="$4"
      flexDirection="column"
      alignItems="center"
      gap="$1"
    >
      <NavButton
        active={activeKey === "cap"}
        onPress={() => onSelect("cap")}
        aria-label="Pekulo — accueil"
        aria-selected={activeKey === "cap"}
      >
        <Compass size={22} color={iconColor(activeKey === "cap")} />
      </NavButton>
      <View marginVertical="$2" height={1} width={32} backgroundColor="$borderDefault" />
      <View flexDirection="column" gap="$1" flex={1}>
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={activeKey === key}
            onPress={() => onSelect(key)}
            aria-label={label}
            aria-selected={activeKey === key}
          >
            <Icon size={18} color={iconColor(activeKey === key)} />
          </NavButton>
        ))}
      </View>
      <NavButton
        active={activeKey === "settings"}
        onPress={() => onSelect("settings")}
        aria-label="Paramètres"
        aria-selected={activeKey === "settings"}
      >
        <Settings size={18} color={iconColor(activeKey === "settings")} />
      </NavButton>
    </View>
  );
}
