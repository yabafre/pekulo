"use client";

import { RadioGroup as TamaRadioGroup, type RadioGroupProps } from "@tamagui/radio-group";
import type { ComponentProps, ReactNode } from "react";

function Root(props: RadioGroupProps & { children: ReactNode }) {
  return <TamaRadioGroup {...props} />;
}

function Item({
  children,
  ...props
}: ComponentProps<typeof TamaRadioGroup.Item> & { children?: ReactNode }) {
  return (
    <TamaRadioGroup.Item
      size="$3"
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
    >
      <TamaRadioGroup.Indicator backgroundColor="$color" />
      {children}
    </TamaRadioGroup.Item>
  );
}

export const PekuloRadioGroup = Object.assign(Root, { Item });
