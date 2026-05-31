"use client";

import { Switch as TamaSwitch, type SwitchProps } from "@tamagui/switch";

// Pekulo switch primitive (ADR-0007 — Tamagui Core, the ONE switch in the DS).
// Visual model mirrors shadcn's Switch (track + thumb flip per state),
// TR-strict grayscale (no accent — perf tokens stay for ± monetary deltas).
//
// Colour is driven by `activeStyle`, NOT inline props or a styled() variant —
// learned from @tamagui/switch/src/createSwitch.tsx:175-181: when `checked` and
// no `activeStyle` is given, the component injects `backgroundColor:
// '$backgroundActive'` AT RUNTIME, after our props, so any inline/variant track
// colour is overridden in the ON state (that was the "invisible when on" bug —
// the track went #000 on the #000 page). Passing `activeStyle` suppresses that
// injection (`!activeStyle`) and the library spreads ours instead — on the
// Frame when checked, and on the Thumb when active (createSwitch.tsx:91).
//
// Contrast (NFR-22/23/24):
//   OFF — track $backgroundMuted (#161616), thumb $color (#ededed) → light knob
//         on a dark track.
//   ON  — track $color (#ededed), thumb $background (#000000) → dark knob on a
//         light track.
// The default SwitchThumb base colour is already $color, so OFF needs no thumb
// override; we set it explicitly anyway for clarity.
//
// Dims are explicit (52×30 track, 24px thumb, 3px inset) — bigger than the
// token-derived default (was 42×21, too small) and independent of the $true
// size-token math. The thumb slide is the library's own translateX flip
// (createSwitch.tsx:74), unaffected by explicit sizing.
//
// Animation: an inline CSS `transition` (the `style` prop), NOT Tamagui's
// `animation="quick"` prop. The v5-css animation driver is a no-op in this build
// (no DS component uses it; PekuloProgress documents the same "doesn't apply in
// our setup" + falls back to plain CSS). The inline transition animates BOTH the
// thumb's translateX slide and the track/thumb colour fade, survives prop
// merging (verified in the snapshot — present even when ToggleRow adds opacity),
// and is collapsed for `prefers-reduced-motion` by the global `!important` guard
// in reset.css.
const TRANSITION = {
  transitionProperty: "transform, background-color",
  transitionDuration: "160ms",
  transitionTimingFunction: "ease",
} as const;

export function PekuloSwitch({ checked, ...props }: SwitchProps) {
  return (
    <TamaSwitch
      checked={checked}
      width={52}
      height={30}
      padding={3}
      borderWidth={0}
      borderRadius={1000}
      cursor="pointer"
      backgroundColor="$backgroundMuted"
      activeStyle={{ backgroundColor: "$color" }}
      style={TRANSITION}
      focusVisibleStyle={{
        outlineColor: "$borderFocus",
        outlineStyle: "solid",
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      {...props}
    >
      <TamaSwitch.Thumb
        width={24}
        height={24}
        borderRadius={1000}
        backgroundColor="$color"
        activeStyle={{ backgroundColor: "$background" }}
        style={TRANSITION}
      />
    </TamaSwitch>
  );
}
