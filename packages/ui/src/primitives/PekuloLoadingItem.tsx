"use client";

import { Text, View } from "tamagui";
import type { ReactNode } from "react";
import { PekuloSpinner } from "./PekuloSpinner";

// PekuloLoadingItem — shadcn-style `Item` composition for inline loading
// rows. Renders a spinner + title (+ optional trailing content) inside a
// muted rounded surface. Used as the "Mise à jour…" affordance during
// background refetches, and as a placeholder row inside lists while a
// mutation is in flight.

export interface PekuloLoadingItemProps {
  /** Primary text (e.g. "Mise à jour…", "Traitement du paiement…"). */
  title: ReactNode;
  /** Optional trailing content right-aligned (e.g. an amount, an ETA). */
  trailing?: ReactNode;
  /** Spinner size in px. Defaults to 16. */
  spinnerSize?: number;
}

export function PekuloLoadingItem({ title, trailing, spinnerSize = 16 }: PekuloLoadingItemProps) {
  return (
    <View
      role="status"
      aria-live="polite"
      flexDirection="row"
      alignItems="center"
      gap="$3"
      paddingHorizontal="$4"
      paddingVertical="$3"
      borderRadius="$lg"
      backgroundColor="$backgroundElevated"
    >
      <View flexShrink={0}>
        <PekuloSpinner size={spinnerSize} ariaLabel="" />
      </View>
      <View flex={1} minWidth={0}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {title}
        </Text>
      </View>
      {trailing !== undefined && trailing !== null && (
        <View flexShrink={0}>
          {typeof trailing === "string" || typeof trailing === "number" ? (
            <Text color="$colorTertiary" fontSize="$caption" fontVariant={["tabular-nums"]}>
              {trailing}
            </Text>
          ) : (
            trailing
          )}
        </View>
      )}
    </View>
  );
}
