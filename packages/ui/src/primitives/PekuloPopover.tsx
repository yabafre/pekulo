"use client";

import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
import type { ButtonHTMLAttributes, ComponentProps, CSSProperties, ReactNode } from "react";

function Root({ placement = "bottom", ...props }: PopoverProps & { children: ReactNode }) {
  return <TamaPopover placement={placement} {...props} />;
}

// Default trigger styles — Tamagui's asChild Slot clones the button and
// merges its own View styles onto it via the `is_View` class. View's
// default `flex-direction: column` would stack icon + label vertically.
// Prepend sensible row-flex defaults so the common pattern (icon + text
// inline) just works without each consumer remembering to set
// `flexDirection: "row"`. Caller-supplied `style` spreads AFTER and wins.
const DEFAULT_TRIGGER_STYLE: CSSProperties = {
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
};

function Trigger({
  children,
  style,
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
      <button type="button" style={{ ...DEFAULT_TRIGGER_STYLE, ...style }} {...props}>
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
