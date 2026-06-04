"use client";

// apps/web/src/app/(cap)/dashboard/_components/cap-view.tsx
// Cap view — `/dashboard` default. Story 7-2 (D1): the hand-built bento +
// placeholders are gone; the page now renders the CONFIGURABLE widget grid.
// resolveLayout merges the user's saved layout against the registry defaults
// (AC-6, FR-41 default order); `editing` (from the shell's "Personnaliser"
// toggle, via context) swaps the read grid for the dnd edit layer. The hero
// reads total wealth from the 7-1 overview (AC-8); the compass donut % is its
// own widget. AddMilestoneDialogProvider stays so the milestones widget can
// open the add-milestone dialog.
import { AddMilestoneDialogProvider } from "./add-milestone-dialog";
import { useCapDashboardState } from "../_compass/_components/compass-section";
import { useDashboardEdit } from "./dashboard-edit-context";
import { useDashboardLayout } from "../_hooks/use-dashboard-layout";
import { resolveLayout } from "../_widgets/layout";
import { WidgetGrid } from "../_widgets/widget-grid";

export function CapView() {
  const cap = useCapDashboardState();
  const horizonMax = cap?.horizonAbsoluteYearMax ?? new Date().getUTCFullYear() + 1;
  const { widgets } = useDashboardLayout();
  const { editing } = useDashboardEdit();
  const resolved = resolveLayout(widgets);

  return (
    <AddMilestoneDialogProvider horizonAbsoluteYearMax={horizonMax}>
      <WidgetGrid widgets={resolved} editing={editing} />
    </AddMilestoneDialogProvider>
  );
}
