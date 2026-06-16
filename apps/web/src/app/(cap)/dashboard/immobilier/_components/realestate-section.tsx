"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import {
  PekuloDialog,
  PekuloDialogCloseX as DialogCloseX,
  PekuloLoadingItem,
  PekuloSkeleton,
  Section,
  pekuloFontSizes,
  pekuloRadius,
} from "@pekulo/ui";
import { Plus } from "lucide-react";
import type { PropertyDerivesItem } from "@pekulo/types";
import { useProperties } from "../_hooks/use-properties";
import { useListPropertyDerives } from "../_hooks/use-list-property-derives";
import { PropertyCreateForm } from "./property-create-form";
import { PropertyCard } from "./property-card";
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
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
};

export function RealestateSection() {
  const t = useTranslations("immobilier");
  const properties = useProperties();
  const derives = useListPropertyDerives();
  const [createOpen, setCreateOpen] = useState(false);

  // Hydration guard — lessons.md 2026-05-24 (TanStack cache vs SSR).
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const isLoading = !isHydrated || properties.isLoading || derives.isLoading;
  const isRefetching = !isLoading && (properties.isFetching || derives.isFetching);
  const error = properties.error ?? derives.error;
  const rows = useMemo(() => properties.data ?? [], [properties.data]);
  const derivesById = useMemo(() => {
    const map = new Map<string, PropertyDerivesItem>();
    for (const d of derives.data ?? []) {
      map.set(d.propertyId, d);
    }
    return map;
  }, [derives.data]);

  const { totalValuation, totalEquity, totalDebt } = useMemo(() => {
    const tv = rows.reduce((s, p) => s + p.currentValuation, 0);
    const te = rows.reduce((s, p) => {
      const d = derivesById.get(p.id);
      return s + (d?.netEquityEur ?? p.currentValuation);
    }, 0);
    return { totalValuation: tv, totalEquity: te, totalDebt: tv - te };
  }, [rows, derivesById]);

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
          {t("section.loading")}
        </Text>
        <View
          flexDirection="column"
          gap="$6"
          $lg={{ flexDirection: "row", gap: "$4", alignItems: "stretch" }}
        >
          <View width="100%" $lg={{ flex: 7, flexBasis: 0, minWidth: 0 }}>
            <Section ariaLabel={t("section.equityLoadingAria")} className={styles.cardStretch}>
              <PekuloSkeleton height={12} />
              <View height={16} />
              <PekuloSkeleton block height={44} />
              <View height={12} />
              <PekuloSkeleton lines={1} height={14} />
            </Section>
          </View>
          <View width="100%" $lg={{ flex: 5, flexBasis: 0, minWidth: 0 }}>
            <Section ariaLabel={t("section.actionLoadingAria")} className={styles.cardStretch}>
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
          {t("section.loadError", { message: error.message })}
        </Text>
      </View>
    );
  }

  return (
    <View flexDirection="column" gap="$6" width="100%" $lg={{ gap: 16 }}>
      {isRefetching && (
        <View alignSelf="flex-start">
          <PekuloLoadingItem title={t("section.refetching")} />
        </View>
      )}
      {/* Hero + Action — 7/5 split on lg+ (ux-preview L1650-1667 parity). */}
      <View
        flexDirection="column"
        gap="$6"
        $lg={{ flexDirection: "row", gap: "$4", alignItems: "stretch" }}
      >
        <View width="100%" $lg={{ flex: 7, flexBasis: 0, minWidth: 0 }}>
          <Section ariaLabel={t("section.equityTotalAria")} className={styles.cardStretch}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("section.equityLabel")}
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
              {t("section.subline", {
                valuation: eur0.format(totalValuation),
                debt: eur0.format(totalDebt),
              })}
            </Text>
          </Section>
        </View>
        <View width="100%" $lg={{ flex: 5, flexBasis: 0, minWidth: 0 }}>
          <Section ariaLabel={t("section.actionAria")} className={styles.cardStretch}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("section.portfolioLabel")}
            </Text>
            <Text
              color="$color"
              fontSize="$body"
              fontWeight="600"
              marginTop="$2"
              $lg={{ fontSize: "$h2" }}
              fontVariant={["tabular-nums"]}
            >
              {t("section.propertyCount", { count: rows.length })}
            </Text>
            <View paddingTop="$4">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                style={addPill}
                aria-label={t("section.addAria")}
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden={true} /> {t("section.addProperty")}
              </button>
            </View>
          </Section>
        </View>
      </View>

      {rows.length === 0 ? (
        <Section ariaLabel={t("section.emptyAria")}>
          <Text color="$colorTertiary" fontSize="$bodySm">
            {t("section.empty")}
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
            <PekuloDialog.Title>{t("create.dialogTitle")}</PekuloDialog.Title>
            <PekuloDialog.Description>{t("create.dialogDescription")}</PekuloDialog.Description>
            <PropertyCreateForm onSuccess={() => setCreateOpen(false)} />
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    </View>
  );
}
