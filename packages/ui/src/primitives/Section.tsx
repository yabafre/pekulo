"use client";

// packages/ui/src/primitives/Section.tsx
// The single section container primitive. Uniform `bg-card p-5/6 rounded-xl`
// (UX spec § Section). Optional header with title + action.

import type { ReactNode } from "react";
import { Text, View } from "tamagui";

export interface SectionProps {
  /** Class name escape hatch for parent grid placement (Tamagui passes through). */
  className?: string;
  /** Accessible label — applied as aria-label. */
  ariaLabel?: string;
  /** Section title rendered in the header. */
  title?: string;
  /** Optional action element rendered right-aligned in the header. */
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ className, ariaLabel, title, action, children }: SectionProps) {
  return (
    <View
      render="section"
      className={className}
      aria-label={ariaLabel}
      backgroundColor="$backgroundCard"
      borderRadius="$xl"
      padding="$5"
      $lg={{ padding: "$6" }}
    >
      {(title || action) && (
        <View
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="$4"
        >
          {title ? (
            <Text color="$color" fontSize="$h3" fontWeight="600">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}
