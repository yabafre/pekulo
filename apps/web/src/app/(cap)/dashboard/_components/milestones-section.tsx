"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PekuloMilestoneRow, Section, pekuloRadius, useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useMilestones } from "../_hooks/use-milestones";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { useDeleteMilestone } from "../_hooks/use-delete-milestone";
import { deriveMilestoneCardItems } from "@/lib/derive-milestone-card-items";
import { AddMilestoneForm } from "./add-milestone-form";

export interface MilestonesSectionProps {
  currentWealth: number;
  horizonAbsoluteYearMax: number;
  /** Compass objectif + horizonYears feed the linear-plan donut math in
   *  `deriveMilestoneCardItems` (mirrors ux-preview MilestoneRow's
   *  `linearPlanForYear` computation). Both optional so a degraded paint
   *  during the first compass-query resolution still renders rows. */
  compassObjectif?: number;
  compassHorizonYears?: number;
}

// Right-aligned `HeaderAction` pill — mirrors ux-preview's `HeaderAction`
// (h-8 / px-3 / bg-muted / text-fg). Lives inside the Section header so the
// "Ajouter" affordance reads like the rest of the Cap surface, not a
// separate footer button.
const headerActionStyle: React.CSSProperties = {
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  borderRadius: pekuloRadius.full,
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};

export function MilestonesSection({
  currentWealth,
  horizonAbsoluteYearMax,
  compassObjectif,
  compassHorizonYears,
}: MilestonesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();
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
          // AC-5: surface server-side delete failures via the @pekulo/ui toast
          // primitive (the optimistic onMutate already removed the row; on
          // error use-delete-milestone restores it). The hook's rollback +
          // the toast together give the user a "row came back + here's why".
          toast.danger("Suppression échouée", err.message);
        },
      },
    );
  };
  const headerAction = (
    <button
      type="button"
      onClick={() => setShowForm((v) => !v)}
      aria-expanded={showForm}
      aria-controls="add-milestone-form"
      style={headerActionStyle}
    >
      <Plus size={12} strokeWidth={2.25} aria-hidden={true} color="var(--color)" />
      <span>{showForm ? "Fermer" : "Ajouter"}</span>
    </button>
  );
  return (
    <View flexDirection="column" gap="$3">
      <Section ariaLabel={`Paliers (${items.length}/20)`} title="Paliers" action={headerAction}>
        <View flexDirection="column">
          {items.length === 0 ? (
            <Text color="$colorTertiary" fontSize="$caption" paddingVertical="$3">
              Aucun palier — ajoute le premier pour rythmer le cap.
            </Text>
          ) : (
            items.map((m) => (
              <PekuloMilestoneRow
                key={m.id ?? `${m.label}-${m.targetYear}`}
                milestone={m}
                onDelete={handleDelete}
                isDeleting={pendingDeleteId === m.id}
              />
            ))
          )}
        </View>
      </Section>
      {showForm && (
        <View id="add-milestone-form" role="region" aria-label="Formulaire d'ajout de palier">
          <AddMilestoneForm
            milestoneCount={milestonesQ.data?.length ?? 0}
            horizonAbsoluteYearMax={horizonAbsoluteYearMax}
            onSuccess={() => setShowForm(false)}
          />
        </View>
      )}
    </View>
  );
}
