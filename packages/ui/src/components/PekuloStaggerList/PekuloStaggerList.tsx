"use client";

// packages/ui/src/components/PekuloStaggerList.tsx
// Wraps children in a list-element and computes per-child stagger delays
// via useStagger. Honours prefers-reduced-motion (delays collapse to 0).
// Animation primitive is left to consumers — this component exposes the
// computed delays via `data-stagger-index` so a CSS rule (or Tamagui
// animation) can pick them up.

import { Children, type ReactNode } from "react";
import { View } from "tamagui";
import { useStagger } from "../../animations/use-stagger";

export interface PekuloStaggerListProps {
  children: ReactNode;
  /** Per-item delay in ms (default 40 ms — UX-spec § StaggerList). */
  delayMs?: number;
  className?: string;
  ariaLabel?: string;
}

export function PekuloStaggerList({
  children,
  delayMs = 40,
  className,
  ariaLabel,
}: PekuloStaggerListProps) {
  const items = Children.toArray(children);
  const delays = useStagger(items.length, delayMs);
  return (
    <View
      render="ul"
      className={className}
      aria-label={ariaLabel}
      flexDirection="column"
      style={{ listStyle: "none", padding: 0, margin: 0 }}
    >
      {items.map((child, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key -- stable order per render
          key={i}
          render="li"
          style={{ animationDelay: `${delays[i] ?? 0}ms` }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
