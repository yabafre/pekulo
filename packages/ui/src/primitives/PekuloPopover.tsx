"use client";

import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
import type { ComponentProps, ReactNode } from "react";

function Root({ placement = "bottom", ...props }: PopoverProps & { children: ReactNode }) {
  return <TamaPopover placement={placement} {...props} />;
}

function Trigger({
  children,
  ...props
}: ComponentProps<typeof TamaPopover.Trigger> & { children: ReactNode }) {
  // Force the trigger to render as <button> so aria-expanded/-controls/-haspopup
  // (set automatically by @tamagui/popover) are valid attrs (axe-core 4.x flags
  // them on <div>). v2 default would render <div>.
  return (
    <TamaPopover.Trigger render="button" unstyled {...props}>
      {children}
    </TamaPopover.Trigger>
  );
}

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaPopover.Content> & { children: ReactNode }) {
  return (
    <TamaPopover.Content
      backgroundColor="$backgroundElevated"
      borderRadius={12}
      padding={12}
      gap={8}
      transition="quick"
      enterStyle={{ opacity: 0, y: -4 }}
      exitStyle={{ opacity: 0, y: -4 }}
      {...props}
    >
      {children}
    </TamaPopover.Content>
  );
}

function Arrow(props: ComponentProps<typeof TamaPopover.Arrow>) {
  return <TamaPopover.Arrow backgroundColor="$backgroundElevated" {...props} />;
}

const Close = TamaPopover.Close;

export const PekuloPopover = Object.assign(Root, { Trigger, Content, Arrow, Close });
