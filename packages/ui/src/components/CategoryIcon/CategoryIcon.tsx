"use client";

import type { ComponentType, CSSProperties } from "react";
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
} from "lucide-react";

// lucide icon component shape (the subset of props we pass + a style passthrough).
type IconProps = {
  size?: number | string;
  color?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
};
type IconComponent = ComponentType<IconProps>;

// Per-category display icon (DR-13). Keyed by the RAW category value (the
// @pekulo/validators string literals) so @pekulo/ui carries no
// @pekulo/validators dependency — the keys are plain strings. Any key absent
// here (or a future un-mapped value) falls back to <Tag>. 'transfer' maps to
// ArrowLeftRight, preserving the story 5-3 AC-8 caption glyph.
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
  /** Raw category value (e.g. "courses"), NOT the display label. */
  category: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

// Presentational category → lucide icon. Always aria-hidden: rows / pickers
// announce the category via its text label, never the glyph (NFR-22/24).
// Unknown keys render <Tag> so a category added to the enum without a map
// entry still renders something neutral instead of crashing.
export function CategoryIcon({
  category,
  size = 14,
  color = "var(--colorTertiary)",
  style,
}: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category] ?? Tag;
  return <Icon size={size} color={color} style={style} aria-hidden={true} />;
}
