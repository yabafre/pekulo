// packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.native.tsx
import type { ComponentType } from "react";
import { Building2, Compass, LineChart, Receipt, Wallet } from "lucide-react-native";
import { Text, View, styled, useTheme } from "tamagui";
import type { PekuloNavKey } from "../PekuloNavRail/PekuloNavRail.native";
import { pekuloSpacing } from "../../tokens";

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface NavItem {
  key: PekuloNavKey;
  label: string;
  icon: IconComponent;
}

const NAV_ITEMS: NavItem[] = [
  { key: "cap", label: "Cap", icon: Compass },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "monthly", label: "Mensuel", icon: LineChart },
  { key: "portfolio", label: "Portefeuille", icon: Wallet },
  { key: "realestate", label: "Immobilier", icon: Building2 },
];

const NavTabButton = styled(View, {
  name: "PekuloMobileBottomNavItem",
  role: "button",
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  paddingVertical: "$2",
  borderRadius: "$md",
  backgroundColor: "transparent",
});

export interface PekuloMobileBottomNavProps {
  activeKey: PekuloNavKey | null;
  onSelect: (key: PekuloNavKey) => void;
}

export function PekuloMobileBottomNav({ activeKey, onSelect }: PekuloMobileBottomNavProps) {
  const theme = useTheme();
  return (
    <View
      aria-label="Navigation rapide"
      backgroundColor="$background"
      flexDirection="row"
      paddingTop={pekuloSpacing[2]}
      paddingBottom={pekuloSpacing[5]}
      paddingHorizontal={pekuloSpacing[2]}
    >
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = activeKey === key;
        return (
          <NavTabButton
            key={key}
            onPress={() => onSelect(key)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            accessibilityState={{ selected: active }}
          >
            <Icon
              size={20}
              strokeWidth={1.75}
              color={active ? theme.color.val : theme.colorTertiary.val}
            />
            <Text
              fontSize={10}
              lineHeight={12}
              letterSpacing={-0.1}
              color={active ? "$color" : "$colorTertiary"}
              fontWeight="500"
              numberOfLines={1}
              textAlign="center"
            >
              {label}
            </Text>
          </NavTabButton>
        );
      })}
    </View>
  );
}
