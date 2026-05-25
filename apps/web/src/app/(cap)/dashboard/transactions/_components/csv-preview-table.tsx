"use client";

// Story 5-2 — render the parsed CSV row breakdown. Pure flex layout — mobile
// stacks the row fields vertically; desktop ($lg = 1024px per the 2026-05-17
// media-keys lesson) lays them out horizontally with allocated widths.
// Tamagui's typed `display` prop rejects "grid", and a typed grid layout
// isn't required by AC-12 — flex meets the spec. Per-row error renders below
// with a red accent. Read-only — no per-row CRUD (the user fixes the CSV and
// re-pastes), so the 2026-05-17 mobile-kebab guidance does not apply.

import { Text, View } from "@pekulo/ui/client";
import { pekuloRadius } from "@pekulo/ui";
import { Check, X } from "lucide-react";
import type { PreviewedRow } from "@pekulo/validators";

export interface CsvPreviewTableProps {
  rows: PreviewedRow[];
  accountLabelById: Map<string, string>;
}

export function CsvPreviewTable({ rows, accountLabelById }: CsvPreviewTableProps) {
  return (
    <View flexDirection="column" gap="$2" role="table" aria-label="Aperçu CSV">
      {rows.map((row) => {
        const isValid = row.parsed !== undefined;
        const accountDisplay = row.parsed
          ? (accountLabelById.get(row.parsed.accountId) ?? row.raw.accountLabel)
          : row.raw.accountLabel;
        return (
          <View
            key={row.index}
            flexDirection="column"
            gap="$1"
            paddingVertical="$2"
            paddingHorizontal="$2"
            borderRadius={pekuloRadius.md}
            backgroundColor={isValid ? "transparent" : "$perfLossSoft"}
            role="row"
            aria-label={
              isValid
                ? `Ligne ${row.index + 1} valide`
                : `Ligne ${row.index + 1} invalide: ${row.error}`
            }
          >
            <View
              flexDirection="column"
              gap="$1"
              $lg={{ flexDirection: "row", alignItems: "center", gap: "$3" }}
            >
              <View flexDirection="row" alignItems="center" gap="$2" $lg={{ width: 28 }}>
                {isValid ? (
                  // Use `--perfGain` (Pekulo's positive-perf token, emerald
                  // per TR-fidelity feedback memory) for full green / red
                  // semantic parity with the X icon below.
                  <Check size={16} strokeWidth={2} aria-hidden color="var(--perfGain)" />
                ) : (
                  <X size={16} strokeWidth={2} aria-hidden color="var(--danger)" />
                )}
                <Text $lg={{ display: "none" }} fontSize="$caption" color="$colorTertiary">
                  Ligne {row.index + 1}
                </Text>
              </View>
              <Text fontSize="$bodySm" role="cell" $lg={{ width: 110 }}>
                {row.raw.occurredOn || "—"}
              </Text>
              <Text fontSize="$bodySm" role="cell" $lg={{ width: 100, textAlign: "right" }}>
                {row.raw.amountRaw || "—"}
              </Text>
              <Text fontSize="$bodySm" role="cell" $lg={{ flex: 1.4, flexBasis: 0, minWidth: 0 }}>
                {row.raw.label || "—"}
              </Text>
              <Text
                fontSize="$bodySm"
                role="cell"
                color={isValid ? "$color" : "$colorTertiary"}
                $lg={{ flex: 1.2, flexBasis: 0, minWidth: 0 }}
              >
                {accountDisplay || "—"}
              </Text>
            </View>
            {row.error && (
              <View $lg={{ paddingLeft: 36 }}>
                <Text fontSize="$caption" color="$danger" role="alert">
                  {row.error}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
