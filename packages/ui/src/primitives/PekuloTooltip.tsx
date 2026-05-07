"use client";

import { Tooltip as TamaTooltip, type TooltipProps } from "@tamagui/tooltip";
import type { ComponentProps, ReactNode } from "react";

function Root({ delay = 400, ...props }: TooltipProps & { children: ReactNode }) {
  return <TamaTooltip delay={delay} {...props} />;
}

function Trigger({
  children,
  ...props
}: ComponentProps<typeof TamaTooltip.Trigger> & { children: ReactNode }) {
  // Render as <button> so aria-describedby (auto-injected) is valid.
  return (
    <TamaTooltip.Trigger render="button" unstyled {...props}>
      {children}
    </TamaTooltip.Trigger>
  );
}

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaTooltip.Content> & { children: ReactNode }) {
  return (
    <TamaTooltip.Content
      backgroundColor="$backgroundElevated"
      borderRadius="$md"
      paddingHorizontal={10}
      paddingVertical={6}
      transition="quick"
      enterStyle={{ opacity: 0, y: -4 }}
      exitStyle={{ opacity: 0, y: -4 }}
      {...props}
    >
      {children}
    </TamaTooltip.Content>
  );
}

function Arrow(props: ComponentProps<typeof TamaTooltip.Arrow>) {
  return <TamaTooltip.Arrow backgroundColor="$backgroundElevated" {...props} />;
}

export const PekuloTooltip = Object.assign(Root, { Trigger, Content, Arrow });
