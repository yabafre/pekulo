"use client";

import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

function Root({ placement = "bottom", ...props }: PopoverProps & { children: ReactNode }) {
  return <TamaPopover placement={placement} {...props} />;
}

function Trigger({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  // Trigger renders as a native <button> via Tamagui's `asChild` slot so
  // aria-expanded / -controls / -haspopup (set automatically by
  // @tamagui/popover) are valid HTML attrs (axe-core 4.x flags them on
  // <div>; the v2 default Trigger element is a div).
  //
  // We pass a real <button> as the child instead of `render="button" unstyled`
  // because Tamagui 2.0.0-rc.41 leaks `unstyled={true}` to the rendered DOM
  // (React warns: "Received `true` for a non-boolean attribute `unstyled`").
  // The `asChild` slot bypasses Tamagui's styled-View pipeline entirely —
  // Popover.Trigger forwards aria-expanded / data-state / onPress (→ onClick)
  // onto our <button> without injecting its own DOM element. Caller-supplied
  // `style`, `aria-label`, `onClick`, etc. spread directly onto the button.
  return (
    <TamaPopover.Trigger asChild>
      <button type="button" {...props}>
        {children}
      </button>
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
      borderRadius="$lg"
      padding="$3"
      gap="$2"
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
