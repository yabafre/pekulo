"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.tsx
// Story 6-9 (FR-64) — presentational ‹ prev / next › control + the month label.
// State lives in the provider (month-scope-context). GRAYSCALE only — nav arrows
// + label are control chrome, NOT a ± delta (lesson 2026-05-07 $accent rule).
// The label is a polite live region so screen readers announce month changes.

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Text, View } from "@pekulo/ui/client";
import { formatMonthLong } from "./month-key";
import { useMonthScope } from "./month-scope-context";

const navBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorSecondary)",
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 9999,
};

export function MonthNavigator() {
  const { month, goPrev, goNext } = useMonthScope();
  return (
    <View
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingVertical="$2"
    >
      <button type="button" aria-label="Mois précédent" style={navBtn} onClick={goPrev}>
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <Text
        role="status"
        aria-live="polite"
        fontSize="$body"
        fontWeight="600"
        color="$color"
        textTransform="capitalize"
      >
        {month ? formatMonthLong(month) : "—"}
      </Text>
      <button type="button" aria-label="Mois suivant" style={navBtn} onClick={goNext}>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>
    </View>
  );
}
