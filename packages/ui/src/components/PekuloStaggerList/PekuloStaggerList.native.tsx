// packages/ui/src/components/PekuloStaggerList/PekuloStaggerList.native.tsx
// Native stagger container using Tamagui View (omits web <ul>/<li> and CSS animationDelay).

import { Children, type ReactNode } from "react";
import { View } from "tamagui";
import { useStagger } from "../../animations/use-stagger";

export interface PekuloStaggerListProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
  ariaLabel?: string;
}

export function PekuloStaggerList({ children, delayMs = 40, ariaLabel }: PekuloStaggerListProps) {
  const items = Children.toArray(children);
  useStagger(items.length, delayMs);
  return (
    <View aria-label={ariaLabel} flexDirection="column">
      {items.map((child, i) => (
        <View key={i}>{child}</View>
      ))}
    </View>
  );
}
