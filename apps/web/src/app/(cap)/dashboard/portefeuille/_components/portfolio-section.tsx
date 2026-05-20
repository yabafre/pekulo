"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloPopover, Section, pekuloRadius } from "@pekulo/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import type { Holding } from "@pekulo/validators";
import { useHoldings } from "../_hooks/use-holdings";
// Cross-route hook import is intentional — accounts list is required for
// the holding-create-form `accountId` selector. The hook is the
// orchestration boundary (ADR-0010), so cross-feature hook reads are
// allowed by convention. NOTE: `pekulo/no-cross-feature-action-import`
// currently only resolves `@/features/*` imports — relative paths under
// the App-Router tree fall outside its scope (see the rule file's TODO
// header). The boundary on this line is convention-enforced; the lint
// gate will catch a future `*-actions.ts` cross-import once the rule's
// resolver is extended to App-Router paths.
import { useAccounts } from "../../parametres/_hooks/use-accounts";
import { HoldingCreateForm } from "./holding-create-form";
import { LotForm } from "./lot-form";
import { HoldingCloseConfirm } from "./holding-close-confirm";
import { ClassRow } from "./class-row";
import { HoldingRow } from "./holding-row";

// PortfolioSection — orchestrates hero + Répartition + Lignes for
// /dashboard/portefeuille. The 3-3 portfolio-fx primitives
// (`computeSnapshotFx`, `computeHoldingPnl`) are NOT consumed here —
// story 7-1 will own the snapshot read at the dashboard aggregation
// boundary. For 3-4 we compute a transparent client-side EUR
// approximation: `marketValueEur = quantity * lastPrice` when the
// holding currency is EUR, OR `quantity * lastPrice` raw when not EUR
// (the FX-multi-currency snapshot ships in 7-1 — see Dev Notes §
// "Decisions re-applied from 3-3"). `unrealisedPnl = (lastPrice -
// avgCost) * quantity`. The hero label clarifies this is the
// EUR-anchored view.

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function signed(amount: number): string {
  return `${amount >= 0 ? "+" : ""}${eur0.format(amount)}`;
}

// Best-effort EUR approximation. 3-3's `computeSnapshotFx` is the
// canonical FX-resolved snapshot — wired in 7-1.
function approxEurValue(h: Holding): number {
  return h.quantity * h.lastPrice;
}

function approxPnl(h: Holding): number {
  return (h.lastPrice - h.avgCost) * h.quantity;
}

type DialogKind =
  | { kind: "create" }
  | { kind: "lot"; holding: Holding }
  | { kind: "close"; holding: Holding }
  | null;

const addPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
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

export function PortfolioSection() {
  const { data: holdings, isLoading, error } = useHoldings();
  const { data: accounts } = useAccounts();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const rows = holdings ?? [];
  const accountLabel = (id: string): string | null =>
    accounts?.find((a) => a.id === id)?.label ?? null;

  const total = rows.reduce((s, h) => s + approxEurValue(h), 0);
  const totalPnl = rows.reduce((s, h) => s + approxPnl(h), 0);
  const totalCost = total - totalPnl;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

  const byKind = {
    etf: rows.filter((h) => h.kind === "etf").reduce((s, h) => s + approxEurValue(h), 0),
    action: rows.filter((h) => h.kind === "action").reduce((s, h) => s + approxEurValue(h), 0),
    crypto: rows.filter((h) => h.kind === "crypto").reduce((s, h) => s + approxEurValue(h), 0),
  };

  if (isLoading) {
    return (
      <View paddingVertical="$6">
        <Text color="$colorTertiary" fontSize="$bodySm">
          Chargement du portefeuille…
        </Text>
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
    <View
      flexDirection="column"
      gap="$6"
      width="100%"
      $lg={{ maxWidth: 1024, marginHorizontal: "auto", gap: 40 }}
    >
      {/* Hero + Répartition — stacked on mobile, 7/5 split on lg+ (ux-preview parity) */}
      <View flexDirection="column" gap="$6" $lg={{ flexDirection: "row", gap: "$4" }}>
        {/* Hero — Valeur totale (card-wrapped via Section primitive) */}
        <View $lg={{ flex: 7 }}>
          <Section ariaLabel="Valeur totale du portefeuille">
            <Text color="$colorTertiary" fontSize="$caption">
              Valeur portefeuille · EUR
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
              {eur0.format(total)}
            </Text>
            <View flexDirection="row" alignItems="center" gap={6} marginTop="$2">
              <Text
                color={totalPnl >= 0 ? "$accent" : "$danger"}
                fontSize="$bodySm"
                fontWeight="500"
                fontVariant={["tabular-nums"]}
              >
                {signed(totalPnl)}
              </Text>
              <Text color="$colorTertiary" fontSize="$bodySm" fontVariant={["tabular-nums"]}>
                ({totalPnl >= 0 ? "+" : ""}
                {(totalPnlPct * 100).toFixed(2)} %) plus-value latente
              </Text>
            </View>
          </Section>
        </View>

        {/* Répartition par classe (card-wrapped via Section primitive) */}
        <View $lg={{ flex: 5 }}>
          <Section ariaLabel="Répartition par classe">
            <Text color="$colorTertiary" fontSize="$caption" marginBottom="$3">
              Répartition
            </Text>
            <View render="ul" flexDirection="column" margin={0} padding={0}>
              <ClassRow label="ETF" amount={byKind.etf} pct={total > 0 ? byKind.etf / total : 0} />
              <ClassRow
                label="Actions"
                amount={byKind.action}
                pct={total > 0 ? byKind.action / total : 0}
              />
              <ClassRow
                label="Crypto"
                amount={byKind.crypto}
                pct={total > 0 ? byKind.crypto / total : 0}
              />
            </View>
          </Section>
        </View>
      </View>

      {/* Lignes (card-wrapped via Section primitive with title + action header) */}
      <Section
        ariaLabel="Lignes"
        title="Lignes"
        action={
          <button
            type="button"
            onClick={() => setDialog({ kind: "create" })}
            style={addPill}
            aria-label="Ajouter un placement"
          >
            <Plus size={14} strokeWidth={2.25} aria-hidden={true} />
            Ajouter
          </button>
        }
      >
        {rows.length === 0 ? (
          <Text color="$colorTertiary" fontSize="$bodySm">
            Aucun placement pour le moment. Clique « Ajouter » pour créer le premier.
          </Text>
        ) : (
          <View render="ul" flexDirection="column" margin={0} padding={0}>
            {rows.map((h) => (
              <View key={h.id} render="li" margin={0} padding={0}>
                <HoldingRow
                  holding={h}
                  accountLabel={accountLabel(h.accountId)}
                  marketValueEur={approxEurValue(h)}
                  unrealisedPnlEur={approxPnl(h)}
                  unrealisedPnlPct={h.avgCost > 0 ? (h.lastPrice - h.avgCost) / h.avgCost : 0}
                  trailing={
                    <PekuloPopover>
                      <PekuloPopover.Trigger
                        aria-label={`Actions pour ${h.ticker ?? h.label}`}
                        style={kebabBtn}
                      >
                        <MoreHorizontal size={16} aria-hidden={true} />
                      </PekuloPopover.Trigger>
                      <PekuloPopover.Content>
                        <View flexDirection="column" padding="$1" gap="$1">
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "lot", holding: h })}
                            style={popoverActionBtnNeutral}
                          >
                            Enregistrer un lot
                          </button>
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "close", holding: h })}
                            style={popoverActionBtnDanger}
                          >
                            Marquer comme clôturé
                          </button>
                        </View>
                      </PekuloPopover.Content>
                    </PekuloPopover>
                  }
                />
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Create dialog */}
      <PekuloDialog
        open={dialog?.kind === "create"}
        onOpenChange={(next) => setDialog(next ? { kind: "create" } : null)}
      >
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <PekuloDialog.Title>Ajouter un placement</PekuloDialog.Title>
            <PekuloDialog.Description>
              Ticker, devise, quantité et prix unitaire moyen. Crypto et ETF acceptés.
            </PekuloDialog.Description>
            <HoldingCreateForm accounts={accounts ?? []} onSuccess={() => setDialog(null)} />
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>

      {/* Lot dialog */}
      {dialog?.kind === "lot" && (
        <LotForm holding={dialog.holding} open onOpenChange={(next) => !next && setDialog(null)} />
      )}

      {/* Close dialog */}
      {dialog?.kind === "close" && (
        <HoldingCloseConfirm
          holding={dialog.holding}
          open
          onOpenChange={(next) => !next && setDialog(null)}
        />
      )}
    </View>
  );
}
