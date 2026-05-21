"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloPopover, PekuloPropertyCard, Section, pekuloRadius } from "@pekulo/ui";
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
  fontSize: 14,
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

  // Derive UI props from canonical RealEstate + derive surface (4-2).
  const netEquity = derives?.netEquityEur ?? property.currentValuation;
  const debtRemaining = property.currentValuation - netEquity;
  const repaidPct = clamp01(netEquity / property.currentValuation);
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
      <PekuloPropertyCard
        property={{
          label: property.label,
          valuationEur: property.currentValuation,
          debtRemainingEur: debtRemaining,
          monthlyPaymentEur: 0,
          yearsRemaining: 0,
          repaidPct,
        }}
      />
      {cashflow !== null && (
        <View marginTop="$3" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderDefault">
          <Text color="$colorTertiary" fontSize="$caption">
            Cash-flow mensuel
          </Text>
          <Text
            color={cashflow >= 0 ? "$accent" : "$danger"}
            fontSize="$h3"
            fontWeight="600"
            fontVariant={["tabular-nums"]}
            marginTop="$1"
          >
            {cashflow >= 0 ? "+" : ""}
            {eur0.format(cashflow)}
          </Text>
        </View>
      )}

      {/* Mortgage attach/update dialog — single PekuloDialog driven by `mode`. */}
      {(dialog?.kind === "mortgage-attach" || dialog?.kind === "mortgage-update") && (
        <PekuloDialog open onOpenChange={(next) => !next && setDialog(null)}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <PekuloDialog.Title>
                {mortgage ? "Modifier le crédit" : "Ajouter un crédit"}
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Capital restant, taux, mensualité, durée restante et date de début.
              </PekuloDialog.Description>
              <MortgageForm
                property={property}
                mortgage={mortgage}
                mode={mortgage ? "update" : "attach"}
                onSuccess={() => setDialog(null)}
              />
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
              <PekuloDialog.Title>
                {rental ? "Modifier le loyer" : "Ajouter un loyer"}
              </PekuloDialog.Title>
              <PekuloDialog.Description>
                Loyer mensuel, charges et statut meublé.
              </PekuloDialog.Description>
              <RentalForm
                property={property}
                rental={rental}
                mode={rental ? "update" : "attach"}
                onSuccess={() => setDialog(null)}
              />
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
