"use client";

// PekuloSelect — shadcn-parity API on a Tamagui (@tamagui/select)
// backend. Compound surface mirrors shadcn's `Select` family:
//
//   <PekuloSelect>
//     <PekuloSelect.Trigger> <PekuloSelect.Value placeholder="…" /> </PekuloSelect.Trigger>
//     <PekuloSelect.Content>
//       <PekuloSelect.Group>
//         <PekuloSelect.Label>Section</PekuloSelect.Label>
//         <PekuloSelect.Item value="…" index={0}>Label</PekuloSelect.Item>
//         <PekuloSelect.Item value="…" index={1}>Label</PekuloSelect.Item>
//       </PekuloSelect.Group>
//       <PekuloSelect.Separator />
//       <PekuloSelect.Group>...</PekuloSelect.Group>
//     </PekuloSelect.Content>
//   </PekuloSelect>
//
// Differences from shadcn / Radix:
//   - Trigger renders a ChevronDown automatically (no need to mount
//     Select.Icon manually).
//   - Item renders an inline Check ItemIndicator on the right when the
//     value matches, mirroring shadcn.
//   - Item requires `index` (Tamagui's a11y model needs it; we surface it
//     as a clearly-typed prop so consumers don't forget).

import {
  Select as TamaSelect,
  SelectSeparator as TamaSelectSeparator,
  type SelectProps,
} from "@tamagui/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// ─── Root ────────────────────────────────────────────────────────────────

function Root<Value extends string = string>(props: SelectProps<Value>) {
  return <TamaSelect {...props} />;
}

// ─── Group ───────────────────────────────────────────────────────────────

function Group({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Group> & { children: ReactNode }) {
  return (
    <TamaSelect.Group padding="$1" {...props}>
      {children}
    </TamaSelect.Group>
  );
}

// ─── Value ───────────────────────────────────────────────────────────────

const Value = TamaSelect.Value;

// ─── Trigger ─────────────────────────────────────────────────────────────

function Trigger({
  children,
  controlSize = "md",
  ...props
}: ComponentProps<typeof TamaSelect.Trigger> & {
  children: ReactNode;
  controlSize?: "sm" | "md";
}) {
  return (
    <TamaSelect.Trigger
      data-slot="select-trigger"
      data-size={controlSize}
      backgroundColor="$backgroundMuted"
      borderRadius="$lg"
      borderWidth={0}
      paddingHorizontal="$3"
      height={controlSize === "sm" ? 32 : 40}
      gap="$2"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      cursor="pointer"
      width="100%"
      hoverStyle={{ backgroundColor: "$backgroundElevated" }}
      focusVisibleStyle={{
        outlineColor: "$color",
        outlineStyle: "solid",
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      {...props}
    >
      {children}
      {/* No asChild — Tamagui Select.Icon forwards onPress via the slot
       * pattern; a raw lucide SVG ignores onPress and React 19 warns.
       * Letting Icon render its own wrapper around the SVG avoids it. */}
      <TamaSelect.Icon>
        <ChevronDown size={16} aria-hidden={true} color="var(--colorTertiary)" />
      </TamaSelect.Icon>
    </TamaSelect.Trigger>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Content> & { children: ReactNode }) {
  return (
    <TamaSelect.Content {...props}>
      <TamaSelect.ScrollUpButton
        alignItems="center"
        justifyContent="center"
        position="relative"
        width="100%"
        height="$3"
        backgroundColor="$backgroundElevated"
        cursor="default"
      >
        <ChevronUp size={14} aria-hidden={true} color="var(--colorTertiary)" />
      </TamaSelect.ScrollUpButton>
      {/* `elevate={false}` + `bordered={false}` — Tamagui Select.Viewport
       * extends a ListItem-style component whose default `elevate` /
       * `bordered` variants leak as boolean DOM attributes in rc.42
       * (React 19 warns "Received `true` for a non-boolean attribute").
       * Disabling both turns off the leak; we set our own border-radius
       * + backgroundColor + padding to keep the popover styling. */}
      <TamaSelect.Viewport
        backgroundColor="$backgroundElevated"
        borderRadius="$lg"
        padding="$1"
        minWidth={200}
        zIndex={200000}
        // @ts-expect-error — Tamagui v2-rc.42 doesn't expose elevate/
        // bordered in Viewport's type defs but defaults them to true
        // at runtime, leaking as `<div elevate="true" bordered="true">`
        // which React 19 warns about. Pass them as strings (React keeps
        // strings on DOM unchanged) to satisfy the warning, then they
        // become valid data-like attributes.
        elevate="false"
        bordered="false"
      >
        {children}
      </TamaSelect.Viewport>
      <TamaSelect.ScrollDownButton
        alignItems="center"
        justifyContent="center"
        position="relative"
        width="100%"
        height="$3"
        backgroundColor="$backgroundElevated"
        cursor="default"
      >
        <ChevronDown size={14} aria-hidden={true} color="var(--colorTertiary)" />
      </TamaSelect.ScrollDownButton>
    </TamaSelect.Content>
  );
}

// ─── Label ───────────────────────────────────────────────────────────────

function Label(props: ComponentProps<typeof TamaSelect.Label>) {
  return (
    <TamaSelect.Label
      data-slot="select-label"
      color="$colorTertiary"
      fontSize="$xs"
      fontWeight="500"
      letterSpacing={0.4}
      textTransform="uppercase"
      paddingHorizontal="$2"
      paddingVertical="$1"
      {...props}
    />
  );
}

// ─── Item ────────────────────────────────────────────────────────────────

function Item({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode }) {
  return (
    <TamaSelect.Item
      data-slot="select-item"
      paddingHorizontal="$2"
      paddingVertical="$2"
      paddingRight={28}
      borderRadius="$md"
      cursor="pointer"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      hoverStyle={{ backgroundColor: "$backgroundMuted" }}
      focusStyle={{ backgroundColor: "$backgroundMuted" }}
      {...props}
    >
      <TamaSelect.ItemText color="$color" fontSize="$bodySm">
        {children}
      </TamaSelect.ItemText>
      <TamaSelect.ItemIndicator marginLeft="auto">
        <Check size={14} aria-hidden={true} color="var(--color)" />
      </TamaSelect.ItemIndicator>
    </TamaSelect.Item>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────

function Separator(props: ComponentProps<typeof TamaSelectSeparator>) {
  return (
    <TamaSelectSeparator
      data-slot="select-separator"
      height={1}
      backgroundColor="$borderDefault"
      marginVertical="$1"
      marginHorizontal={-4}
      {...props}
    />
  );
}

// ─── Compose ─────────────────────────────────────────────────────────────

export const PekuloSelect = Object.assign(Root, {
  Group,
  Value,
  Trigger,
  Content,
  Label,
  Item,
  Separator,
});
