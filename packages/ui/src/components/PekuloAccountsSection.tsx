"use client";

// packages/ui/src/components/PekuloAccountsSection.tsx
// Comptes section — N rows + hairline footer with `Total liquide`.

import { Text, View } from "tamagui";
import type { AccountCardItem } from "@pekulo/types";
import { Section } from "../primitives/Section";
import { PekuloAccountRow } from "./PekuloAccountRow";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloAccountsSectionProps {
  accounts: AccountCardItem[];
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Footer label (default "Total liquide"). */
  totalLabel?: string;
}

export function PekuloAccountsSection({
  accounts,
  className,
  title = "Comptes",
  ariaLabel,
  totalLabel = "Total liquide",
}: PekuloAccountsSectionProps) {
  const total = accounts.reduce((sum, a) => sum + a.balanceEur, 0);
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <View flexDirection="column">
        {accounts.map((account, i) => (
          // eslint-disable-next-line react/no-array-index-key -- accounts lack stable ids
          <PekuloAccountRow key={`${account.label}-${i}`} {...account} />
        ))}
      </View>
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingTop="$3"
        marginTop="$2"
        borderTopWidth={1}
        borderColor="$borderDefault"
      >
        <Text color="$colorTertiary" fontSize="$caption">
          {totalLabel}
        </Text>
        <Text color="$color" fontSize="$bodySm" fontWeight="600">
          {eur0.format(total)}
        </Text>
      </View>
    </Section>
  );
}
