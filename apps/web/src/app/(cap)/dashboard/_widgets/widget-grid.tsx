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
import type { ResolvedWidget } from "./layout";
import styles from "../_components/bento.module.css";

const WidgetEditLayer = dynamic(
  () => import("./edit/widget-edit-layer").then((m) => m.WidgetEditLayer),
  { ssr: false, loading: () => null },
);

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
          {visible.map((w) => (
            <div key={w.id} style={{ gridColumn: `span ${w.colSpan} / span ${w.colSpan}` }}>
              {w.render()}
            </div>
          ))}
        </div>
      </View>
    </>
  );
}
