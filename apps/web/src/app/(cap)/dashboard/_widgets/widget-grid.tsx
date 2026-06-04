"use client";
// apps/web/src/app/(cap)/dashboard/_widgets/widget-grid.tsx
// Story 7-2 (AC-1, AC-3) — the read-view grid. Renders the VISIBLE widgets in
// order (mobile flat column / desktop 12-col bento). The dnd edit layer is
// reached ONLY through a dynamic(ssr:false) boundary, so @dnd-kit never enters
// the default route bundle (AC-3) — it loads only after the user enters
// "Personnaliser". The render() of each widget is the registry's element
// factory (hooks run inside the returned component, not here).
import dynamic from "next/dynamic";
import { View } from "@pekulo/ui/client";
import type { DashboardWidgetId } from "@pekulo/validators";
import type { ResolvedWidget } from "./layout";
import styles from "../_components/bento.module.css";

const WidgetEditLayer = dynamic(
  () => import("./edit/widget-edit-layer").then((m) => m.WidgetEditLayer),
  { ssr: false, loading: () => null },
);

// Each widget reuses the matching bento card class, which carries both its
// grid-column/grid-row span AND the cell-fill rule (`.xCard { display:flex }` +
// `.xCard > * { flex:1 }`) so the card stretches to its row track instead of
// floating at the top of an oversized cell. Widgets without a dedicated cell
// (nextMilestone, opt-in) fall back to an inline column span.
const CARD_CLASS: Partial<Record<DashboardWidgetId, string>> = {
  hero: styles.heroCard,
  compass: styles.donutCard,
  trajectory: styles.trajectoryCard,
  milestones: styles.milestonesCard,
  composition: styles.compositionCard,
  recentActivity: styles.recentActivityCard,
  hypothesis: styles.hypothesisCard,
};

export function WidgetGrid({ widgets, editing }: { widgets: ResolvedWidget[]; editing: boolean }) {
  if (editing) return <WidgetEditLayer widgets={widgets} />;
  const visible = widgets.filter((w) => w.visible);
  return (
    <>
      <View $lg={{ display: "none" }}>
        <View flexDirection="column" gap="$10">
          {visible.map((w) => (
            <View key={w.id}>{w.render()}</View>
          ))}
        </View>
      </View>
      <View display="none" $lg={{ display: "block" }}>
        <div className={styles.bento}>
          {visible.map((w) => {
            const cls = CARD_CLASS[w.id];
            return (
              <div
                key={w.id}
                className={cls}
                style={cls ? undefined : { gridColumn: `span ${w.colSpan} / span ${w.colSpan}` }}
              >
                {w.render()}
              </div>
            );
          })}
        </div>
      </View>
    </>
  );
}
