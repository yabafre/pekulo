"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  PekuloDialog,
  PekuloDialogCloseX as DialogCloseX,
  PekuloDonut,
  PekuloPopover,
  Section,
  pekuloFontSizes,
  pekuloRadius,
} from "@pekulo/ui";
import { MoreHorizontal } from "lucide-react";
import type {
  PropertyType,
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  PropertyDerivesItem,
} from "@pekulo/types";
import { MortgageForm } from "./mortgage-form";
import { RentalForm } from "./rental-form";
import { ValuationUpdateForm } from "./valuation-update-form";
import { ValuationHistoryDialog } from "./valuation-history-dialog";
import { PropertyDeleteConfirm } from "./property-delete-confirm";
import { useProperty } from "../_hooks/use-property";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const TYPE_LABEL: Record<PropertyType, string> = {
  "residence-principale": "Résidence principale",
  locatif: "Locatif",
  autre: "Autre",
};

const kebabBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: pekuloRadius.full,
};

const popoverActionBtnBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "8px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
  borderRadius: pekuloRadius.md,
  textAlign: "left",
};
const popoverActionBtnNeutral: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--color)",
};
const popoverActionBtnDanger: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--danger)",
};

type DialogKind =
  | { kind: "mortgage-attach" | "mortgage-update" }
  | { kind: "rental-attach" | "rental-update" }
  | { kind: "valuation" }
  | { kind: "history" }
  | { kind: "delete" }
  | null;

export interface PropertyCardProps {
  property: RealEstate;
  derives: PropertyDerivesItem | null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function PropertyCard({ property, derives }: PropertyCardProps) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  // Fetch property children only when we need them (open mortgage/rental dialog).
  const childrenQuery = useProperty(
    dialog !== null &&
      (dialog.kind === "mortgage-attach" ||
        dialog.kind === "mortgage-update" ||
        dialog.kind === "rental-attach" ||
        dialog.kind === "rental-update")
      ? property.id
      : null,
  );
  const mortgage: RealEstateMortgage | null =
    childrenQuery.data?.ok && childrenQuery.data.data.mortgage
      ? childrenQuery.data.data.mortgage
      : null;
  const rental: RealEstateRental | null =
    childrenQuery.data?.ok && childrenQuery.data.data.rental
      ? childrenQuery.data.data.rental
      : null;

  // Derive UI values from canonical RealEstate + 4-2 derive surface.
  // `hasMortgage` is inferred from the derive — netEquityEur < currentValuation
  // implies the API knows about an outstanding principal. Without a mortgage,
  // netEquityEur === currentValuation, and we hide the dette/donut blocks
  // entirely (showing "0 € dette restante / 100 % remboursé" on a property
  // the user just created without a loan was actively misleading).
  const netEquity = derives?.netEquityEur ?? property.currentValuation;
  const debtRemaining = property.currentValuation - netEquity;
  const hasMortgage = derives !== null && netEquity < property.currentValuation - 0.5;
  const repaidPct = hasMortgage ? clamp01(netEquity / property.currentValuation) : 1;
  const cashflow = derives?.monthlyCashFlowEur ?? null;

  return (
    <Section
      ariaLabel={property.label}
      title={property.label}
      action={
        <View flexDirection="row" alignItems="center" gap="$2">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            letterSpacing={0.5}
            textTransform="uppercase"
          >
            {TYPE_LABEL[property.propertyType]}
          </Text>
          <PekuloPopover>
            <PekuloPopover.Trigger aria-label={`Actions pour ${property.label}`} style={kebabBtn}>
              <MoreHorizontal size={16} aria-hidden={true} />
            </PekuloPopover.Trigger>
            <PekuloPopover.Content>
              <View flexDirection="column" padding="$1" gap="$1">
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "valuation" })}
                  style={popoverActionBtnNeutral}
                >
                  Mettre à jour la valorisation
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "history" })}
                  style={popoverActionBtnNeutral}
                >
                  Voir l'historique
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "mortgage-attach" })}
                  style={popoverActionBtnNeutral}
                >
                  Ajouter / Modifier le crédit
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "rental-attach" })}
                  style={popoverActionBtnNeutral}
                >
                  Ajouter / Modifier le loyer
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "delete" })}
                  style={popoverActionBtnDanger}
                >
                  Supprimer le bien
                </button>
              </View>
            </PekuloPopover.Content>
          </PekuloPopover>
        </View>
      }
    >
      {/* Body — route-local inline render. PekuloPropertyCard was dropped
       * because it always renders the dette restante + mensualité + ans
       * restants block, even when no mortgage is attached. Without mortgage
       * data at list level (4-3 doesn't fetch children per card), those
       * fields rendered as "0 €" / "0 ans restants" — confusing the user
       * about info they never entered. Inline render shows only what the
       * data supports.
       *
       * Layout discipline (2026-05-24 mobile fix): single-column vertical
       * stack on EVERY breakpoint. The previous 2-column layout (`$lg`
       * responsive override) collapsed visually on mobile — Tamagui's
       * responsive prop didn't reliably reset flexDirection on the small
       * media query, so VALORISATION and DETTE RESTANTE rendered on top
       * of each other. Vertical stack is also better mobile UX per
       * ui-ux-pro-max §5 content-priority: the hero metric (VALORISATION)
       * is large and unambiguous; secondary metrics (EQUITY, DETTE) sit
       * below in a clean key↔value rhythm. Card width on lg+ is wide
       * enough that vertical reading remains comfortable. */}
      <View flexDirection="column" gap="$4">
        {/* Hero metric — VALORISATION */}
        <View>
          <Text color="$colorTertiary" fontSize="$caption" letterSpacing={0.5}>
            VALORISATION
          </Text>
          <Text
            color="$color"
            fontSize="$h1"
            fontWeight="600"
            marginTop="$1"
            fontVariant={["tabular-nums"]}
          >
            {eur0.format(property.currentValuation)}
          </Text>
        </View>

        {/* Equity — secondary line, label left + value right */}
        <View flexDirection="row" justifyContent="space-between" alignItems="baseline" gap="$3">
          <Text color="$colorTertiary" fontSize="$caption" letterSpacing={0.5}>
            EQUITY
          </Text>
          <Text color="$color" fontSize="$h3" fontWeight="500" fontVariant={["tabular-nums"]}>
            {eur0.format(netEquity)}
          </Text>
        </View>

        {/* Mortgage block (only when hasMortgage) — dette + donut */}
        {hasMortgage && (
          <>
            <View flexDirection="row" justifyContent="space-between" alignItems="baseline" gap="$3">
              <Text color="$colorTertiary" fontSize="$caption" letterSpacing={0.5}>
                DETTE RESTANTE
              </Text>
              <Text color="$color" fontSize="$h3" fontWeight="500" fontVariant={["tabular-nums"]}>
                {eur0.format(debtRemaining)}
              </Text>
            </View>
            <View flexDirection="row" alignItems="center" gap="$3">
              <PekuloDonut pct={repaidPct} size={32} stroke={3} />
              <Text color="$colorSecondary" fontSize="$caption">
                {Math.round(repaidPct * 100)} % remboursé
              </Text>
            </View>
          </>
        )}

        {/* Cashflow (only when set) — separator + key↔value */}
        {cashflow !== null && (
          <View
            paddingTop="$3"
            borderTopWidth={1}
            borderTopColor="$borderDefault"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="baseline"
            gap="$3"
          >
            <Text color="$colorTertiary" fontSize="$caption">
              Cash-flow mensuel
            </Text>
            <Text
              color={cashflow >= 0 ? "$accent" : "$danger"}
              fontSize="$h3"
              fontWeight="600"
              fontVariant={["tabular-nums"]}
            >
              {cashflow >= 0 ? "+" : ""}
              {eur0.format(cashflow)}
            </Text>
          </View>
        )}
      </View>

      {/* Mortgage attach/update dialog — single PekuloDialog driven by `mode`. */}
      {(dialog?.kind === "mortgage-attach" || dialog?.kind === "mortgage-update") && (
        <PekuloDialog open onOpenChange={(next) => !next && setDialog(null)}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <DialogCloseX />
              <PekuloDialog.Title>
                {mortgage ? "Modifier le crédit" : "Ajouter un crédit"}
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Capital restant, taux, mensualité, durée restante et date de début.
              </PekuloDialog.Description>
              {mortgage ? (
                <MortgageForm
                  property={property}
                  mode="update"
                  mortgage={mortgage}
                  onSuccess={() => setDialog(null)}
                />
              ) : (
                <MortgageForm property={property} mode="attach" onSuccess={() => setDialog(null)} />
              )}
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}

      {/* Rental attach/update dialog. */}
      {(dialog?.kind === "rental-attach" || dialog?.kind === "rental-update") && (
        <PekuloDialog open onOpenChange={(next) => !next && setDialog(null)}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <DialogCloseX />
              <PekuloDialog.Title>
                {rental ? "Modifier le loyer" : "Ajouter un loyer"}
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Loyer mensuel, charges et statut meublé.
              </PekuloDialog.Description>
              {rental ? (
                <RentalForm
                  property={property}
                  mode="update"
                  rental={rental}
                  onSuccess={() => setDialog(null)}
                />
              ) : (
                <RentalForm property={property} mode="attach" onSuccess={() => setDialog(null)} />
              )}
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}

      {/* Valuation update dialog. */}
      {dialog?.kind === "valuation" && (
        <PekuloDialog open onOpenChange={(next) => !next && setDialog(null)}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <DialogCloseX />
              <PekuloDialog.Title>Mettre à jour la valorisation</PekuloDialog.Title>
              <PekuloDialog.Description>
                La valorisation actuelle sera remplacée et l'historique audit ajouté
                automatiquement.
              </PekuloDialog.Description>
              <ValuationUpdateForm property={property} onSuccess={() => setDialog(null)} />
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}

      {/* Valuation history dialog. */}
      {dialog?.kind === "history" && (
        <ValuationHistoryDialog
          property={property}
          open
          onOpenChange={(next) => !next && setDialog(null)}
        />
      )}

      {/* Delete confirm. */}
      {dialog?.kind === "delete" && (
        <PropertyDeleteConfirm
          property={property}
          open
          onOpenChange={(next) => !next && setDialog(null)}
        />
      )}
    </Section>
  );
}
