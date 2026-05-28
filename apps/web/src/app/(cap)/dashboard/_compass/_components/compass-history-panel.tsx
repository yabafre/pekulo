"use client";

import { useEffect, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloSkeleton, Section } from "@pekulo/ui";
import { useCompassHistory } from "../_hooks/use-compass-history";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function CompassHistoryPanel() {
  const { data, isLoading, error } = useCompassHistory();
  // Hydration guard — lessons.md 2026-05-24 (TanStack cache vs SSR).
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;
  return (
    <Section title="Historique du cap" ariaLabel="Historique du cap">
      {showLoading && (
        <View role="status" aria-live="polite">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement…
          </Text>
          <PekuloSkeleton lines={3} height={36} />
        </View>
      )}
      {error && !showLoading && (
        <Text role="alert" color="$danger" fontSize="$caption">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && (data?.length ?? 0) === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune modification enregistrée.
        </Text>
      )}
      {!showLoading && !error && (data?.length ?? 0) > 0 && (
        <View render="ul" padding={0} margin={0} style={{ listStyle: "none" }}>
          {data!.map((row) => (
            <View
              key={row.id}
              render="li"
              flexDirection="row"
              justifyContent="space-between"
              paddingVertical="$3"
              aria-label={`Cap ${eur0.format(row.objectif)} sur ${row.horizonYears} ans, archivé le ${dateFmt.format(row.valuedOn)}`}
            >
              <View flexDirection="column">
                <Text color="$color" fontSize="$bodySm" fontWeight="500">
                  {eur0.format(row.objectif)} · {row.horizonYears} ans
                </Text>
                <Text color="$colorTertiary" fontSize="$xs">
                  {dateFmt.format(row.valuedOn)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}
