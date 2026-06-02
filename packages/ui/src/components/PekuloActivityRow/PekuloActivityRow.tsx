"use client";

import type { ReactNode } from "react";
import { Text, View } from "tamagui";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { Activity } from "@pekulo/types";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloActivityRowProps {
  tx: Activity;
  // Story 5-3 AC-8 — optional inline glyph rendered before the category text
  // in the caption row (e.g. ⇆ ArrowLeftRight for transfer-tagged rows).
  // Consumers pass an `aria-hidden` lucide icon at 14 px tuned to the caption
  // colour so SR readers announce only the category label, not the glyph.
  categoryPrefix?: ReactNode;
  // Story 6-10 (FR-65) — leading logo avatar (merchant/bank/category). The
  // consumer passes <TransactionLogo src={tx.logoUrl} category={rawCategory} />.
  logo?: ReactNode;
  // Story 6-7 (FR-33 amended) — the category was APPLIED by the LLM on a bulk
  // import (not user-set). Renders a grayscale "· IA" provenance hint after the
  // category. GRAYSCALE only — AI/control chrome never uses $accent/$success
  // (lesson 2026-05-07). The Sparkles glyph is decorative (aria-hidden); the
  // visible "IA" text carries the meaning for screen readers.
  aiApplied?: boolean;
}

export function PekuloActivityRow({ tx, categoryPrefix, logo, aiApplied }: PekuloActivityRowProps) {
  const isInflow = tx.direction === "in";
  const Arrow = isInflow ? ArrowDownRight : ArrowUpRight;
  const arrowColor = isInflow ? "var(--success)" : "var(--colorTertiary)";
  // Inflow amounts share the success accent with the arrow (matches
  // ux-preview ActivityRow at App.tsx:1099 — `isInflow ? "text-gain"
  // : "text-fg"`). TR fidelity rule: emerald lives only on positive
  // perf deltas ; outflow stays default neutral.
  const amountColor = isInflow ? "$success" : "$color";
  const sign = isInflow ? "+" : "−";
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      {logo}
      <Arrow size={18} color={arrowColor} />
      <View flex={1} minWidth={0}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
          {tx.label}
        </Text>
        {/* Caption: account · [category glyph] category. Story 6-8 review —
            the optional category glyph is a flex sibling BETWEEN the two text
            spans, never nested inside a running-text Text, so the decorative
            icon doesn't sit inside a typographic run. Reading order and the
            5-3 AC-8 visual (glyph immediately before the category label) are
            preserved; SR readers still announce only the text (the icon is
            aria-hidden, set by the consumer). Single line: the (often long
            Bridge) account ellipsizes (flexShrink + min-w-0), the glyph +
            category stay pinned (flexShrink:0) so the category never clips. */}
        <View flexDirection="row" alignItems="center" minWidth={0}>
          <Text color="$colorTertiary" fontSize="$xs" flexShrink={1} minWidth={0} numberOfLines={1}>
            {tx.account} ·{" "}
          </Text>
          {categoryPrefix}
          <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} numberOfLines={1}>
            {tx.category}
          </Text>
          {aiApplied ? (
            <>
              <Sparkles
                size={11}
                color="var(--colorTertiary)"
                aria-hidden
                style={{ marginLeft: 4, flexShrink: 0 }}
              />
              <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} marginLeft="$1">
                IA
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <Text color={amountColor} fontSize="$bodySm" fontWeight="500" flexShrink={0}>
        {sign}
        {eur0.format(tx.amountEur)}
      </Text>
    </View>
  );
}
