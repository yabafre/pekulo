"use client";

import { Select as TamaSelect, type SelectProps } from "@tamagui/select";
import type { ComponentProps, ReactNode } from "react";

function Root(props: SelectProps & { children: ReactNode }) {
  return <TamaSelect {...props} />;
}

function Trigger({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Trigger> & { children: ReactNode }) {
  return (
    <TamaSelect.Trigger
      backgroundColor="$backgroundMuted"
      borderRadius="$md"
      // Tamagui's Select.Trigger inherits ListItem default which leaks a
      // 1px hairline border. TR-strict requires zero card borders.
      borderWidth={0}
      paddingHorizontal="$3"
      paddingVertical={10}
      gap="$2"
      flexDirection="row"
      alignItems="center"
      cursor="pointer"
      focusVisibleStyle={{
        outlineColor: "$borderFocus",
        outlineStyle: "solid",
        outlineWidth: 2,
      }}
      {...props}
    >
      {children}
    </TamaSelect.Trigger>
  );
}

const Value = TamaSelect.Value;

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Content> & { children: ReactNode }) {
  return (
    <TamaSelect.Content {...props}>
      <TamaSelect.Viewport
        backgroundColor="$backgroundElevated"
        borderRadius="$lg"
        padding="$1"
        minWidth={200}
        zIndex={200000}
      >
        {children}
      </TamaSelect.Viewport>
    </TamaSelect.Content>
  );
}

function Item({
  children,
  ...props
}: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode }) {
  return (
    <TamaSelect.Item
      paddingHorizontal={10}
      paddingVertical="$2"
      borderRadius="$sm"
      cursor="pointer"
      hoverStyle={{ backgroundColor: "$backgroundMuted" }}
      focusStyle={{ backgroundColor: "$backgroundMuted" }}
      {...props}
    >
      <TamaSelect.ItemText color="$color" fontSize="$caption">
        {children}
      </TamaSelect.ItemText>
    </TamaSelect.Item>
  );
}

export const PekuloSelect = Object.assign(Root, { Trigger, Value, Content, Item });
