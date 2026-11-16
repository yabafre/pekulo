// packages/ui/src/primitives/PekuloPopover.native.tsx
import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
import type { ComponentProps, ReactNode } from "react";
import { View, styled, type ViewProps } from "tamagui";

const TriggerView = styled(View, {
  name: "PekuloPopoverTriggerView",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
});

function Root({
  placement = "bottom",
  allowFlip = true,
  stayInFrame = true,
  offset = 6,
  ...props
}: PopoverProps & { children: ReactNode }) {
  return (
    <TamaPopover
      placement={placement}
      allowFlip={allowFlip}
      stayInFrame={stayInFrame}
      offset={offset}
      {...props}
    />
  );
}

function Trigger({ children, ...props }: Omit<ViewProps, "children"> & { children: ReactNode }) {
  return (
    <TamaPopover.Trigger asChild>
      <TriggerView {...props}>{children}</TriggerView>
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
      borderWidth={1}
      borderColor="$borderStrong"
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
