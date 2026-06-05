"use client";
// apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.tsx
// Story 7-2 (D5, AC-4, AC-5) + resize extension — the ONLY module that imports
// @dnd-kit/*, reached exclusively through the dynamic(ssr:false) boundary in
// WidgetGrid (AC-3). The edit mode renders the actual bento grid: each cell has
// a drag handle (reorder, dnd-kit rectSortingStrategy), a visibility switch, and
// a bottom-right resize handle that snaps the col/row span to the grid units.
// Reorder/toggle/resize-end persist via useDashboardLayout().save; the snap math
// is a pure helper (testable); the pointer drag itself is verified live (jsdom
// reports zero element sizes, so the resize cannot be driven in a unit test).
import { useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Maximize2 } from "lucide-react";
import { PekuloSwitch, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import type { DashboardLayout, DashboardWidgetId } from "@pekulo/validators";
import { useDashboardLayout } from "../../_hooks/use-dashboard-layout";
import { useDashboardEdit } from "../../_components/dashboard-edit-context";
import { defaultLayout, type ResolvedWidget } from "../layout";
import styles from "../../_components/bento.module.css";

const MIN_COL = 1;
const MAX_COL = 12;
const MIN_ROW = 1;
const MAX_ROW = 4;
// Row track floor (220px) + grid gap (16px) — the px a single row span occupies.
const ROW_UNIT_PX = 236;

type EditItem = {
  id: DashboardWidgetId;
  label: string;
  visible: boolean;
  colSpan: number;
  rowSpan: number;
  render: () => React.ReactNode;
};

// Pure: clamp a span to [min,max] after applying a px delta over the unit size.
// A non-positive unit (jsdom reports 0) leaves the span unchanged.
export function snapSpan(
  startSpan: number,
  deltaPx: number,
  unitPx: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(unitPx) || unitPx <= 0) return startSpan;
  const next = startSpan + Math.round(deltaPx / unitPx);
  return Math.max(min, Math.min(max, next));
}

// Pure: serialize the ordered edit items to a stored layout (0-based order +
// the resized spans).
export function serializeLayout(
  items: Pick<EditItem, "id" | "visible" | "colSpan" | "rowSpan">[],
): DashboardLayout {
  return {
    widgets: items.map((it, order) => ({
      id: it.id,
      visible: it.visible,
      order,
      colSpan: it.colSpan,
      rowSpan: it.rowSpan,
    })),
  };
}

function EditCell({
  item,
  gridRef,
  onToggle,
  onResizeLive,
  onResizeCommit,
}: {
  item: EditItem;
  gridRef: React.RefObject<HTMLDivElement | null>;
  onToggle: (id: DashboardWidgetId) => void;
  onResizeLive: (id: DashboardWidgetId, colSpan: number, rowSpan: number) => void;
  onResizeCommit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const drag = useRef<{ x: number; y: number; col: number; row: number } | null>(null);

  function onResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, col: item.colSpan, row: item.rowSpan };
  }
  function onResizeMove(e: React.PointerEvent) {
    const d = drag.current;
    const grid = gridRef.current;
    if (!d || !grid) return;
    const colUnit = grid.clientWidth / MAX_COL;
    const col = snapSpan(d.col, e.clientX - d.x, colUnit, MIN_COL, MAX_COL);
    const row = snapSpan(d.row, e.clientY - d.y, ROW_UNIT_PX, MIN_ROW, MAX_ROW);
    if (col !== item.colSpan || row !== item.rowSpan) onResizeLive(item.id, col, row);
  }
  function onResizeUp(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    onResizeCommit();
  }

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      style={{
        gridColumn: `span ${item.colSpan} / span ${item.colSpan}`,
        gridRow: `span ${item.rowSpan} / span ${item.rowSpan}`,
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--backgroundCard)",
        borderRadius: 12,
        padding: 12,
        opacity: item.visible ? 1 : 0.5,
        overflow: "hidden",
      }}
    >
      <View flexDirection="row" alignItems="center" gap="$2" justifyContent="space-between">
        <View flexDirection="row" alignItems="center" gap="$2" flex={1} minWidth={0}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-roledescription="sortable"
            aria-label={`Déplacer ${item.label}`}
            style={{ background: "transparent", border: 0, cursor: "grab", display: "flex" }}
          >
            <GripVertical size={16} aria-hidden={true} />
          </button>
          <Text color="$color" fontSize="$bodySm" fontWeight="600" numberOfLines={1}>
            {item.label}
          </Text>
        </View>
        <PekuloSwitch
          checked={item.visible}
          onCheckedChange={() => onToggle(item.id)}
          aria-label={`Afficher ${item.label}`}
        />
      </View>

      {/* Live preview — non-interactive so taps reach the controls, dimmed when hidden. */}
      <div
        style={{ flex: 1, minHeight: 0, marginTop: 8, pointerEvents: "none", overflow: "hidden" }}
      >
        {item.render()}
      </div>

      {/* Bottom-right resize handle — drag to change col (x) + row (y) span.
          Pointer-driven (a 2D resize isn't a 1D slider); keyboard resize is a
          follow-up — reorder + visibility are already keyboard-reachable. */}
      <button
        type="button"
        aria-label={`Redimensionner ${item.label} (${item.colSpan}×${item.rowSpan})`}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        style={{
          position: "absolute",
          right: 2,
          bottom: 2,
          width: 22,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: "nwse-resize",
          color: "var(--colorTertiary)",
          touchAction: "none",
        }}
      >
        <Maximize2 size={13} aria-hidden={true} />
      </button>
    </div>
  );
}

export function WidgetEditLayer({ widgets }: { widgets: ResolvedWidget[] }) {
  const { save, reset } = useDashboardLayout();
  const { setEditing } = useDashboardEdit();
  const [items, setItems] = useState<EditItem[]>(() =>
    [...widgets].sort((a, b) => a.order - b.order),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const gridRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next: EditItem[]) {
    setItems(next);
    save(serializeLayout(next));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(items, from, to));
  }

  function handleToggle(id: DashboardWidgetId) {
    commit(items.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)));
  }

  // Resize: update local state live (visual), persist once on pointer-up.
  function handleResizeLive(id: DashboardWidgetId, colSpan: number, rowSpan: number) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, colSpan, rowSpan } : it)));
  }
  function handleResizeCommit() {
    save(serializeLayout(itemsRef.current));
  }

  function handleReset() {
    reset();
    const def = defaultLayout();
    const order = new Map(def.widgets.map((w) => [w.id, w.order]));
    setItems(
      [...widgets]
        .map((w) => ({ ...w, visible: true, colSpan: w.colSpan, rowSpan: w.rowSpan }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    );
  }

  return (
    <Section title="Personnaliser" ariaLabel="Personnaliser le tableau de bord">
      <Text color="$colorTertiary" fontSize="$caption" marginBottom="$3">
        Glisse pour réordonner, le coin pour redimensionner, l'interrupteur pour masquer.
      </Text>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
          <div ref={gridRef} className={styles.bento} role="list">
            {items.map((it) => (
              <EditCell
                key={it.id}
                item={it}
                gridRef={gridRef}
                onToggle={handleToggle}
                onResizeLive={handleResizeLive}
                onResizeCommit={handleResizeCommit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <View flexDirection="row" gap="$4" marginTop="$4" justifyContent="flex-end">
        <View
          render="button"
          onPress={handleReset}
          cursor="pointer"
          backgroundColor="transparent"
          borderWidth={0}
          aria-label="Réinitialiser la disposition"
        >
          <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
            Réinitialiser
          </Text>
        </View>
        <View
          render="button"
          onPress={() => setEditing(false)}
          cursor="pointer"
          backgroundColor="transparent"
          borderWidth={0}
          aria-label="Terminer"
        >
          <Text color="$color" fontSize="$caption" fontWeight="600">
            Terminé
          </Text>
        </View>
      </View>
    </Section>
  );
}
