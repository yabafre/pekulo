"use client";

import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloDialogCloseX as DialogCloseX, PekuloSkeleton } from "@pekulo/ui";
import type { RealEstate } from "@pekulo/types";
import { useListValuations } from "../_hooks/use-list-valuations";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export interface ValuationHistoryDialogProps {
  property: RealEstate;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function ValuationHistoryDialog({
  property,
  open,
  onOpenChange,
}: ValuationHistoryDialogProps) {
  const { data, isLoading, error } = useListValuations(open ? property.id : null);
  // Primary sort: valuedOn desc. Secondary: id desc (cuid-like IDs are
  // monotonically increasing per Prisma `@default(cuid())`) so two rows
  // submitted the same day render in insertion order — AC-2 requires
  // "the just-submitted row appears at the top" even when a same-day
  // prior row exists.
  const rows = (data ?? [])
    .slice()
    .sort((a, b) => +b.valuedOn - +a.valuedOn || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  return (
    <PekuloDialog open={open} onOpenChange={onOpenChange}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <DialogCloseX />
          <View flexDirection="column" gap="$3" padding="$4">
            <PekuloDialog.Title>Historique — {property.label}</PekuloDialog.Title>
            <PekuloDialog.Description>
              Historique complet des valorisations de ce bien (audit trail).
            </PekuloDialog.Description>
            {isLoading && <PekuloSkeleton lines={3} height={32} />}
            {error && (
              <Text role="alert" color="$danger" fontSize="$caption">
                Erreur de chargement : {error.message}
              </Text>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <Text color="$colorTertiary" fontSize="$bodySm">
                Aucune valorisation enregistrée pour le moment.
              </Text>
            )}
            {!isLoading && rows.length > 0 && (
              <View
                render="ul"
                flexDirection="column"
                margin={0}
                padding={0}
                aria-label="Historique des valorisations"
              >
                {rows.map((v) => (
                  <View
                    key={v.id}
                    render="li"
                    flexDirection="row"
                    justifyContent="space-between"
                    paddingVertical="$2"
                    borderBottomWidth={1}
                    borderBottomColor="$borderDefault"
                  >
                    <Text color="$colorSecondary" fontSize="$bodySm">
                      {dateFmt.format(v.valuedOn)}
                    </Text>
                    <Text color="$color" fontSize="$bodySm" fontVariant={["tabular-nums"]}>
                      {eur0.format(v.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
