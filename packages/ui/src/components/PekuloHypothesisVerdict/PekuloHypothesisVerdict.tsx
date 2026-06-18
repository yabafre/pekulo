"use client";

import { Text, View } from "tamagui";

// Story 8-2 i18n — pure presentational verdict. All copy (headline / delta /
// shortfall) is translated + interpolated by the consumer (which owns the
// next-intl context and the €-formatter) and passed in as ready strings, so
// this UI-package component no longer hardcodes French. `reaches` drives the
// delta colour (success ↔ danger) and is the only non-string prop.
export interface PekuloHypothesisVerdictProps {
  /** True when the projected capital meets/exceeds the required cap. */
  reaches: boolean;
  /** Translated headline, e.g. "Tu n'atteins pas ton cap en 2034." */
  headline: string;
  /** Translated delta line, e.g. "−100 051 € vs cap requis". */
  deltaLabel: string;
  /**
   * Story 7-4 (FR-59) — translated €/month shortfall line. Pass it only when
   * the cap is NOT reached and there is a positive gap; omit otherwise.
   */
  gapLabel?: string;
}

export function PekuloHypothesisVerdict({
  reaches,
  headline,
  deltaLabel,
  gapLabel,
}: PekuloHypothesisVerdictProps) {
  return (
    <View flexDirection="column" gap="$1">
      <Text color="$color" fontSize="$bodySm" fontWeight="500">
        {headline}
      </Text>
      <Text
        color={(reaches ? "$success" : "$danger") as never}
        fontSize="$caption"
        fontWeight="500"
      >
        {deltaLabel}
      </Text>
      {gapLabel && (
        <Text color="$colorTertiary" fontSize="$caption">
          {gapLabel}
        </Text>
      )}
    </View>
  );
}
