"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloSkeleton, Section, pekuloRadius } from "@pekulo/ui";
import { Plus } from "lucide-react";
import type { PropertyDerivesItem } from "@pekulo/types";
import { useProperties } from "../_hooks/use-properties";
import { useListPropertyDerives } from "../_hooks/use-list-property-derives";
import { PropertyCreateForm } from "./property-create-form";
import { PropertyCard } from "./property-card";
import { DialogCloseX } from "./dialog-close-x";
import styles from "./realestate.module.css";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const addPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 40,
  padding: "0 16px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--color)",
  color: "var(--colorOnAccent)",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
};

export function RealestateSection() {
  const properties = useProperties();
  const derives = useListPropertyDerives();
  const [createOpen, setCreateOpen] = useState(false);

  const isLoading = properties.isLoading || derives.isLoading;
  const isRefetching = !isLoading && (properties.isFetching || derives.isFetching);
  const error = properties.error ?? derives.error;
  const rows = properties.data ?? [];
  const derivesById = useMemo(() => {
    const map = new Map<string, PropertyDerivesItem>();
    for (const d of derives.data ?? []) {
      map.set(d.propertyId, d);
    }
    return map;
  }, [derives.data]);

  const totalValuation = rows.reduce((s, p) => s + p.currentValuation, 0);
  const totalEquity = rows.reduce((s, p) => {
    const d = derivesById.get(p.id);
    return s + (d?.netEquityEur ?? p.currentValuation);
  }, 0);
  const totalDebt = totalValuation - totalEquity;

  if (isLoading) {
    return (
      <View flexDirection="column" gap="$6" $lg={{ gap: 16 }} role="status" aria-live="polite">
        <Text
          color="$colorTertiary"
          fontSize="$caption"
          position="absolute"
          width={1}
          height={1}
          overflow="hidden"
        >
          Chargement du portefeuille immobilier…
        </Text>
        <View
          flexDirection="column"
          gap="$6"
          $lg={{ flexDirection: "row", gap: "$4", alignItems: "stretch" }}
        >
          <View width="100%" $lg={{ flex: 7, flexBasis: 0, minWidth: 0 }}>
            <Section ariaLabel="Equity nette — chargement" className={styles.cardStretch}>
              <PekuloSkeleton height={12} />
              <View height={16} />
              <PekuloSkeleton block height={44} />
              <View height={12} />
              <PekuloSkeleton lines={1} height={14} />
            </Section>
          </View>
          <View width="100%" $lg={{ flex: 5, flexBasis: 0, minWidth: 0 }}>
            <Section ariaLabel="Action — chargement" className={styles.cardStretch}>
              <PekuloSkeleton height={12} />
              <View height={12} />
              <PekuloSkeleton lines={2} height={20} />
            </Section>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View role="alert" paddingVertical="$6">
        <Text color="$danger" fontSize="$bodySm">
          Erreur de chargement : {error.message}
        </Text>
      </View>
    );
  }

  return (
    <View flexDirection="column" gap="$6" width="100%" $lg={{ gap: 16 }}>
      {isRefetching && (
        <View
          role="status"
          aria-live="polite"
          alignSelf="flex-start"
          paddingHorizontal="$3"
          paddingVertical="$1"
          borderRadius="$full"
          backgroundColor="$backgroundElevated"
        >
          <Text color="$colorTertiary" fontSize="$caption">
            Mise à jour…
          </Text>
        </View>
      )}
      {/* Hero + Action — 7/5 split on lg+ (ux-preview L1650-1667 parity). */}
      <View
        flexDirection="column"
        gap="$6"
        $lg={{ flexDirection: "row", gap: "$4", alignItems: "stretch" }}
      >
        <View width="100%" $lg={{ flex: 7, flexBasis: 0, minWidth: 0 }}>
          <Section ariaLabel="Equity nette total" className={styles.cardStretch}>
            <Text color="$colorTertiary" fontSize="$caption">
              Equity nette · EUR
            </Text>
            <Text
              color="$color"
              fontSize="$h1"
              fontWeight="600"
              letterSpacing={-0.5}
              marginTop="$2"
              fontVariant={["tabular-nums"]}
              $lg={{ fontSize: "$hero" }}
            >
              {eur0.format(totalEquity)}
            </Text>
            <Text
              color="$colorTertiary"
              fontSize="$bodySm"
              marginTop="$2"
              fontVariant={["tabular-nums"]}
            >
              {eur0.format(totalValuation)} valorisation · {eur0.format(totalDebt)} dette restante
            </Text>
          </Section>
        </View>
        <View width="100%" $lg={{ flex: 5, flexBasis: 0, minWidth: 0 }}>
          <Section ariaLabel="Action" className={styles.cardStretch}>
            <Text color="$colorTertiary" fontSize="$caption">
              Portefeuille immobilier
            </Text>
            <Text
              color="$color"
              fontSize="$body"
              fontWeight="600"
              marginTop="$2"
              $lg={{ fontSize: "$h2" }}
              fontVariant={["tabular-nums"]}
            >
              {rows.length} bien{rows.length > 1 ? "s" : ""}
            </Text>
            <View paddingTop="$4">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                style={addPill}
                aria-label="Ajouter un bien immobilier"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden={true} /> Ajouter un bien
              </button>
            </View>
          </Section>
        </View>
      </View>

      {rows.length === 0 ? (
        <Section ariaLabel="Aucun bien">
          <Text color="$colorTertiary" fontSize="$bodySm">
            Aucun bien immobilier pour le moment. Clique « Ajouter un bien » pour créer le premier.
          </Text>
        </Section>
      ) : (
        rows.map((p) => (
          <PropertyCard key={p.id} property={p} derives={derivesById.get(p.id) ?? null} />
        ))
      )}

      {/* Create dialog. */}
      <PekuloDialog open={createOpen} onOpenChange={setCreateOpen}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <DialogCloseX />
            <PekuloDialog.Title>Ajouter un bien</PekuloDialog.Title>
            <PekuloDialog.Description>
              Libellé, type (résidence principale / locatif / autre), valorisation EUR et date.
            </PekuloDialog.Description>
            <PropertyCreateForm onSuccess={() => setCreateOpen(false)} />
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    </View>
  );
}
