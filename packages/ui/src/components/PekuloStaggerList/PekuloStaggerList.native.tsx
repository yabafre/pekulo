// packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx
// Native stagger container using Tamagui View (omits web <ul>/<li> and CSS animationDelay).

import { Children, isValidElement, type ReactNode } from "react";
import { View } from "tamagui";

export interface PekuloStaggerListProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  ariaLabel?: string;
}

export function PekuloStaggerList({ children, ariaLabel }: PekuloStaggerListProps) {
  const items = Children.toArray(children);
  return (
    <View aria-label={ariaLabel} flexDirection="column">
      {items.map((child) => (
        <View key={isValidElement(child) && child.key != null ? String(child.key) : String(child)}>
          {child}
        </View>
      ))}
    </View>
  );
}
