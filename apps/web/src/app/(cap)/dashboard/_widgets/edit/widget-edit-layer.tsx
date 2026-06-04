"use client";
// apps/web/src/app/(cap)/dashboard/_widgets/edit/widget-edit-layer.tsx
// Story 7-2 (D5, AC-4, AC-5) — the ONLY module that imports @dnd-kit/*. It is
// reached exclusively through the dynamic(ssr:false) boundary in WidgetGrid, so
// dnd-kit never enters the default route bundle (AC-3). A vertical sortable
// list of every widget with a keyboard-accessible drag handle + a visibility
// switch; drop/toggle persist via useDashboardLayout().save, "Réinitialiser"
// resets to defaults, "Terminé" exits edit mode. API: the classic
// @dnd-kit/core + @dnd-kit/sortable v6/v10 surface (DndContext + SortableContext
// + useSortable + arrayMove), verified against Context7 before writing.
import { useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { PekuloSwitch, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import type { DashboardLayout, DashboardWidgetId } from "@pekulo/validators";
import { useDashboardLayout } from "../../_hooks/use-dashboard-layout";
import { useDashboardEdit } from "../../_components/dashboard-edit-context";
import { defaultLayout, type ResolvedWidget } from "../layout";

// Pure: serialize (ordered ids, visibility) → a 0-based DashboardLayout.
export function toLayout(
  order: DashboardWidgetId[],
  visibility: Record<string, boolean>,
): DashboardLayout {
  return {
    widgets: order.map((id, index) => ({ id, visible: visibility[id] ?? true, order: index })),
  };
}

// Pure: move `activeId` into `overId`'s slot (the dnd-kit drag result).
export function reorderOrder(
  order: DashboardWidgetId[],
  activeId: DashboardWidgetId,
  overId: DashboardWidgetId,
): DashboardWidgetId[] {
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from < 0 || to < 0) return order;
  return arrayMove(order, from, to);
}

function SortableRow({
  id,
  label,
  visible,
  onToggle,
}: {
  id: DashboardWidgetId;
  label: string;
  visible: boolean;
  onToggle: (id: DashboardWidgetId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-roledescription="sortable"
          aria-label={`Déplacer ${label}`}
          style={{ background: "transparent", border: 0, cursor: "grab", display: "flex" }}
        >
          <GripVertical size={16} aria-hidden={true} />
        </button>
        <Text flex={1} color="$color" fontSize="$bodySm">
          {label}
        </Text>
        <PekuloSwitch
          checked={visible}
          onCheckedChange={() => onToggle(id)}
          aria-label={`Afficher ${label}`}
        />
      </View>
    </div>
  );
}

export function WidgetEditLayer({ widgets }: { widgets: ResolvedWidget[] }) {
  const { save, reset } = useDashboardLayout();
  const { setEditing } = useDashboardEdit();
  const [order, setOrder] = useState<DashboardWidgetId[]>(() => widgets.map((w) => w.id));
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(widgets.map((w) => [w.id, w.visible])),
  );
  const labelById = new Map(widgets.map((w) => [w.id, w.label]));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = reorderOrder(order, active.id as DashboardWidgetId, over.id as DashboardWidgetId);
    setOrder(next);
    save(toLayout(next, visibility));
  }

  function handleToggle(id: DashboardWidgetId) {
    const nextVisibility = { ...visibility, [id]: !(visibility[id] ?? true) };
    setVisibility(nextVisibility);
    save(toLayout(order, nextVisibility));
  }

  function handleReset() {
    reset();
    // Re-sync the local edit state to the registry default so the list reflects
    // the reset without waiting for the refetch round-trip.
    const def = defaultLayout();
    const sorted = [...def.widgets].sort((a, b) => a.order - b.order);
    setOrder(sorted.map((w) => w.id));
    setVisibility(Object.fromEntries(def.widgets.map((w) => [w.id, w.visible])));
  }

  return (
    <Section title="Personnaliser" ariaLabel="Personnaliser le tableau de bord">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <View flexDirection="column" role="list">
            {order.map((id) => (
              <SortableRow
                key={id}
                id={id}
                label={labelById.get(id) ?? id}
                visible={visibility[id] ?? true}
                onToggle={handleToggle}
              />
            ))}
          </View>
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
