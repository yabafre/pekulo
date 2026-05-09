"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PekuloMilestonesCard } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useMilestones } from "../_hooks/use-milestones";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { deriveMilestoneCardItems } from "@/lib/derive-milestone-card-items";
import { AddMilestoneForm } from "./add-milestone-form";

export interface MilestonesSectionProps {
  currentWealth: number;
  horizonAbsoluteYearMax: number;
}

const addPillStyle: React.CSSProperties = {
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
};

export function MilestonesSection({
  currentWealth,
  horizonAbsoluteYearMax,
}: MilestonesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const milestonesQ = useMilestones();
  const statusesQ = useMilestoneStatuses(currentWealth, {
    enabled: (milestonesQ.data?.length ?? 0) > 0,
  });
  const items = deriveMilestoneCardItems({
    milestones: milestonesQ.data ?? [],
    statuses: statusesQ.data ?? [],
    currentWealth,
  });
  return (
    <View flexDirection="column" gap="$3">
      <PekuloMilestonesCard milestones={items} ariaLabel={`Paliers (${items.length}/20)`} />
      <View flexDirection="row" justifyContent="flex-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          aria-controls="add-milestone-form"
          style={addPillStyle}
        >
          <Plus size={14} aria-hidden={true} color="var(--color)" />
          <Text color="$color" fontSize="$caption">
            {showForm ? "Fermer" : "Ajouter un palier"}
          </Text>
        </button>
      </View>
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
