"use client";

import type { ComponentType } from "react";
import { Text, View, styled } from "tamagui";

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

export interface PekuloSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export interface PekuloSegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: PekuloSegmentedOption<T>[];
  ariaLabel: string;
}

// Track geometry — kept in sync between the pill and the segments. The track
// has `padding: PAD` and the segments sit flush (no gap), so each segment is
// `(100% - 2*PAD) / n` wide and the pill of the SAME width slides by whole
// segment widths.
const PAD = 4; // $1

const Segment = styled(View, {
  name: "PekuloSegmented",
  render: "button",
  role: "radio",
  // Above the absolutely-positioned pill (positioned siblings paint over the
  // earlier-in-source pill), so the icon + label stay readable.
  position: "relative",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  flex: 1,
  height: 36,
  borderRadius: "$md",
  cursor: "pointer",
  backgroundColor: "transparent",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
});

export function PekuloSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: PekuloSegmentedControlProps<T>) {
  const n = options.length;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <View
      role="radiogroup"
      aria-label={ariaLabel}
      position="relative"
      flexDirection="row"
      padding={PAD}
      backgroundColor="$backgroundMuted"
      borderRadius="$lg"
    >
      {/* Sliding highlight. A single persistent element whose `transform`
          changes — so the move is a reliable CSS transition (the per-segment
          background toggle did NOT animate). translateX is in units of the
          pill's own width, so step i = i * 100%. Decorative (aria-hidden) and
          click-through (pointerEvents none). prefers-reduced-motion collapses
          the transition to instant via reset.css. */}
      <View
        aria-hidden
        pointerEvents="none"
        position="absolute"
        top={PAD}
        bottom={PAD}
        left={PAD}
        width={`calc((100% - ${2 * PAD}px) / ${n})`}
        backgroundColor="$backgroundElevated"
        borderRadius="$md"
        style={{
          transform: `translateX(calc(${activeIndex} * 100%))`,
          transition: "transform 220ms ease",
        }}
      />
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <Segment key={opt.value} onPress={() => onChange(opt.value)} aria-checked={active}>
            <Icon size={14} color="currentColor" />
            <Text
              color={(active ? "$color" : "$colorSecondary") as never}
              fontSize="$caption"
              fontWeight="500"
            >
              {opt.label}
            </Text>
          </Segment>
        );
      })}
    </View>
  );
}
