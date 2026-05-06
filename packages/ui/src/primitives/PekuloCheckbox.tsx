"use client";

import { Checkbox as TamaCheckbox, type CheckboxProps } from "@tamagui/checkbox";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";

function Root(props: CheckboxProps) {
  return (
    <TamaCheckbox
      size="$3"
      backgroundColor="$backgroundMuted"
      borderWidth={0}
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

function Indicator(props: ComponentProps<typeof TamaCheckbox.Indicator>) {
  return (
    <TamaCheckbox.Indicator {...props}>
      <Check size={14} color="var(--colorOnAccent)" />
    </TamaCheckbox.Indicator>
  );
}

export const PekuloCheckbox = Object.assign(Root, { Indicator });
