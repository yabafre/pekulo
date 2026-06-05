// apps/web/src/app/(cap)/dashboard/_widgets/layout.ts
// Story 7-2 (AC-1, AC-6) — pure reconciliation of a stored layout against the
// widget registry. Start from the registry, overlay the saved {visible,order}
// per id, DROP unknown ids (we only iterate the registry), APPEND registry ids
// missing from the saved layout AFTER the last stored order (so a newly-added
// widget surfaces for existing users), then sort by order. A null saved layout
// → the FR-41-ordered registry default. This is the AC-6 "never throws, always
// renders a coherent layout" guarantee.
import type { ReactNode } from "react";
import type { DashboardLayout, DashboardWidgetId } from "@pekulo/validators";
import { WIDGET_REGISTRY } from "./widget-registry";

export interface ResolvedWidget {
  id: DashboardWidgetId;
  label: string;
  visible: boolean;
  order: number;
  colSpan: number;
  rowSpan: number;
  render: () => ReactNode;
}

export function resolveLayout(saved: DashboardLayout | null): ResolvedWidget[] {
  const savedById = new Map((saved?.widgets ?? []).map((w) => [w.id, w] as const));
  const savedOrders = saved?.widgets?.map((w) => w.order) ?? [];
  let appendCursor = (savedOrders.length ? Math.max(...savedOrders) : -1) + 1;

  return WIDGET_REGISTRY.map((def) => {
    const stored = savedById.get(def.id);
    return {
      id: def.id,
      label: def.label,
      colSpan: stored?.colSpan ?? def.colSpan,
      rowSpan: stored?.rowSpan ?? def.rowSpan,
      render: def.render,
      visible: stored ? stored.visible : def.defaultVisible,
      // A stored widget keeps its order; a registry widget the user never saw
      // (saved != null but missing this id) appends after the last stored one;
      // with no saved layout at all, the registry default order applies.
      order: stored ? stored.order : saved ? appendCursor++ : def.defaultOrder,
    };
  }).sort((a, b) => a.order - b.order);
}

export function defaultLayout(): DashboardLayout {
  return {
    widgets: WIDGET_REGISTRY.map((def) => ({
      id: def.id,
      visible: def.defaultVisible,
      order: def.defaultOrder,
    })),
  };
}
