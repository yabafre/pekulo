// packages/ui/src/components/CategoryIcon/CategoryIcon.native.tsx
import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Martini,
  MonitorSmartphone,
  Plane,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Tag,
  TramFront,
  TriangleAlert,
  Utensils,
} from "lucide-react-native";
import { useTheme } from "tamagui";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};
type IconComponent = ComponentType<IconProps>;

export const CATEGORY_ICONS: Record<string, IconComponent> = {
  salaire: Banknote,
  freelance: Laptop,
  remote: MonitorSmartphone,
  bonus: Gift,
  loyer: House,
  courses: ShoppingCart,
  transport: TramFront,
  sorties: Martini,
  voyage: Plane,
  sante: HeartPulse,
  imprevu: TriangleAlert,
  autre: Tag,
  transfer: ArrowLeftRight,
  factures: ReceiptText,
  restauration: Utensils,
  abonnements: RefreshCw,
  retrait: Landmark,
};

export interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export function CategoryIcon({ category, size = 14, color }: CategoryIconProps) {
  const theme = useTheme();
  const Icon = CATEGORY_ICONS[category] ?? Tag;
  const resolvedColor = color && !color.startsWith("var(") ? color : theme.colorTertiary.val;
  return <Icon size={size} color={resolvedColor} />;
}
