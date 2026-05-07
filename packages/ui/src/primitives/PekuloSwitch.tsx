"use client";

import { Switch as TamaSwitch, type SwitchProps } from "@tamagui/switch";
import type { ComponentProps } from "react";

function Root(props: SwitchProps) {
  return (
    <TamaSwitch
      backgroundColor="$backgroundMuted"
      borderWidth={0}
      cursor="pointer"
      focusVisibleStyle={{
        outlineColor: "$borderFocus",
        outlineStyle: "solid",
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      {...props}
    />
  );
}

function Thumb(props: ComponentProps<typeof TamaSwitch.Thumb>) {
  return <TamaSwitch.Thumb backgroundColor="$colorOnAccent" {...props} />;
}

export const PekuloSwitch = Object.assign(Root, { Thumb });
