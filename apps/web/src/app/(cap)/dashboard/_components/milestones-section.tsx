"use client";

// apps/web/src/app/(cap)/dashboard/_components/milestones-section.tsx
//
// MilestonesCard cell of the Cap-view bento. Mirrors ux-preview
// MilestonesCard (App.tsx:925-942) — Section frame + title "Paliers" +
// header-action pill ("+ Ajouter") + ul of `PekuloMilestoneRow`.
//
// Bento sizing constraint: the cell sits on `row-span-2` (=~ 240 px).
// The list is capped via `maxHeight` + `overflow-y: auto` so a user with
// the full 20-cap doesn't blow the row track. Server-side cap is 20
// (per `MILESTONES_PER_USER_CAP`); UI matches that bound.
//
// The "+ Ajouter" pill opens a shared `PekuloDialog` (mounted at the
// page level via `AddMilestoneDialogProvider`) — the previous V0 inline
// reveal expanded the cell and broke the bento row track.

import { Plus } from "lucide-react";
import { PekuloMilestoneRow, PekuloSkeleton, Section, useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useMilestones } from "../_hooks/use-milestones";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { useDeleteMilestone } from "../_hooks/use-delete-milestone";
import { deriveMilestoneCardItems } from "@/lib/derive-milestone-card-items";
import { useAddMilestoneDialog } from "./add-milestone-dialog";
import styles from "./bento.module.css";

export interface MilestonesSectionProps {
  currentWealth: number;
  /** Compass objectif + horizonYears feed the linear-plan donut math in
   *  `deriveMilestoneCardItems` (mirrors ux-preview MilestoneRow's
   *  `linearPlanForYear` computation). Both optional so a degraded paint
   *  during the first compass-query resolution still renders rows. */
  compassObjectif?: number;
  compassHorizonYears?: number;
  /** Strip the card frame — used by cap-view mobile (ux-preview L334-343). */
  flat?: boolean;
}

export function MilestonesSection({
  currentWealth,
  compassObjectif,
  compassHorizonYears,
  flat,
}: MilestonesSectionProps) {
  const toast = useToast();
  const dialog = useAddMilestoneDialog();
  const milestonesQ = useMilestones();
  const statusesQ = useMilestoneStatuses(currentWealth, {
    enabled: (milestonesQ.data?.length ?? 0) > 0,
  });
  const deleteMutation = useDeleteMilestone();
  const items = deriveMilestoneCardItems({
    milestones: milestonesQ.data ?? [],
    statuses: statusesQ.data ?? [],
    currentWealth,
    compassObjectif,
    compassHorizonYears,
  });
  const pendingDeleteId =
    deleteMutation.isPending && deleteMutation.variables ? deleteMutation.variables.id : null;
  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onError: (err) => {
          toast.danger("Suppression échouée", err.message);
        },
      },
    );
  };

  const headerAction = (
    <button
      type="button"
      className={styles.headerActionPill}
      onClick={() => dialog.open()}
      aria-label="Ajouter un palier"
    >
      <Plus size={12} strokeWidth={2.25} aria-hidden={true} />
      Ajouter
    </button>
  );

  // Distinguish "loading" (no data yet) from "empty" (data is []). The
  // empty-state copy is a CTA; showing it during load would lie about
  // server state. Only show empty-state when the milestones query has
  // resolved to a verified empty array.
  const isInitialLoading = milestonesQ.isLoading && !milestonesQ.data;
  return (
    <Section
      ariaLabel={`Paliers (${items.length}/20)`}
      title="Paliers"
      action={headerAction}
      flat={flat}
    >
      {isInitialLoading ? (
        <View role="status" aria-live="polite" paddingVertical="$2">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement des paliers…
          </Text>
          <PekuloSkeleton lines={3} height={32} />
        </View>
      ) : items.length === 0 ? (
        <Text color="$colorTertiary" fontSize="$caption" paddingVertical="$3">
          Aucun palier — ajoute le premier pour rythmer le cap.
        </Text>
      ) : (
        <View
          render="ul"
          flex={flat ? undefined : 1}
          minHeight={flat ? undefined : 0}
          flexDirection="column"
          style={{
            listStyle: "none",
            // Desktop bento: flex-fills the cell height + scrolls inside.
            // Flat mode (cap-view mobile): natural-height list, no scroll —
            // the parent column flow handles overflow.
            overflowY: flat ? "visible" : "auto",
            paddingInlineStart: 0,
            marginBlock: 0,
          }}
        >
          {items.map((m) => (
            <View key={m.id ?? `${m.label}-${m.targetYear}`} render="li">
              <PekuloMilestoneRow
                milestone={m}
                onDelete={handleDelete}
                isDeleting={pendingDeleteId === m.id}
              />
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}
