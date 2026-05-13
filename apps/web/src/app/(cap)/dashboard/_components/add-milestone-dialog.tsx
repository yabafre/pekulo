"use client";

// apps/web/src/app/(cap)/dashboard/_components/add-milestone-dialog.tsx
//
// `PekuloDialog`-framed AddMilestoneForm. Replaces the V0 inline-reveal
// pattern (form expanded inside the MilestonesCard cell) which broke the
// bento — the cell sat on a `row-span-2` track, the form added another
// ~400px of content, and the grid row pushed every downstream cell
// askew. A modal keeps the bento immutable and gives the form proper
// breathing room.
//
// Shared between:
//   - `MilestonesSection` header pill ("+ Ajouter")
//   - `CompassSection` empty-state setup CTA ("Définis ton premier palier")
// Both flows lift the open state to `dashboard/page.tsx` via the
// `useAddMilestoneDialog()` hook so the dialog renders once at the page
// level (single Portal mount, single set of focus traps).

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { PekuloDialog } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useMilestones } from "../_hooks/use-milestones";
import { AddMilestoneForm } from "./add-milestone-form";

interface AddMilestoneDialogContextValue {
  open: () => void;
  isOpen: boolean;
}

const AddMilestoneDialogContext = createContext<AddMilestoneDialogContextValue | null>(null);

export interface AddMilestoneDialogProviderProps {
  /** Absolute year-max for the target-year validator (currentYear +
   *  compass.horizonYears − 1). When compass info is missing, callers
   *  pass `currentYear + 1` to keep the form callable. */
  horizonAbsoluteYearMax: number;
  children: ReactNode;
}

export function AddMilestoneDialogProvider({
  horizonAbsoluteYearMax,
  children,
}: AddMilestoneDialogProviderProps) {
  // Read milestones at the provider level so the dialog form's `milestoneCount`
  // stays in sync without prop-drilling. React Query caches the result so
  // this doesn't fire an extra fetch beyond what MilestonesSection already does.
  const milestonesQ = useMilestones();
  const milestoneCount = milestonesQ.data?.length ?? 0;
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo<AddMilestoneDialogContextValue>(() => ({ open, isOpen }), [open, isOpen]);
  return (
    <AddMilestoneDialogContext.Provider value={value}>
      {children}
      <PekuloDialog open={isOpen} onOpenChange={setIsOpen}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <View flexDirection="column" gap="$3">
              <PekuloDialog.Title>Ajouter un palier</PekuloDialog.Title>
              <PekuloDialog.Description>
                Un palier marque un cap intermédiaire — capital cible + année.
              </PekuloDialog.Description>
            </View>
            <AddMilestoneForm
              milestoneCount={milestoneCount}
              horizonAbsoluteYearMax={horizonAbsoluteYearMax}
              onSuccess={() => setIsOpen(false)}
            />
            <PekuloDialog.Close asChild>
              <View
                render="button"
                paddingVertical="$2"
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                alignItems="center"
              >
                <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                  Annuler
                </Text>
              </View>
            </PekuloDialog.Close>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    </AddMilestoneDialogContext.Provider>
  );
}

export function useAddMilestoneDialog() {
  const ctx = useContext(AddMilestoneDialogContext);
  if (!ctx) {
    throw new Error(
      "useAddMilestoneDialog must be used inside <AddMilestoneDialogProvider> (page-level mount)",
    );
  }
  return ctx;
}
