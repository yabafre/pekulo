"use client";

// packages/ui/src/primitives/PekuloDialog.tsx
// Pekulo-themed wrapper around @tamagui/dialog. Compound API matches Radix
// / shadcn convention: PekuloDialog (root) + .Trigger + .Portal + .Overlay
// + .Content + .Title + .Description + .Close. Animation driver is the
// package's animations-css (RSC-safe). Surfaces honour TR-strict palette
// (zero hairline borders, $backgroundElevated for the content surface).

import { Dialog as TamaDialog, type DialogProps } from "@tamagui/dialog";
import type { ComponentProps, ReactNode } from "react";

function Root(props: DialogProps) {
  return <TamaDialog modal {...props} />;
}

const Trigger = TamaDialog.Trigger;
const Portal = TamaDialog.Portal;

function Overlay(props: ComponentProps<typeof TamaDialog.Overlay>) {
  return (
    <TamaDialog.Overlay
      backgroundColor="rgba(0, 0, 0, 0.6)"
      transition="quick"
      enterStyle={{ opacity: 0 }}
      exitStyle={{ opacity: 0 }}
      {...props}
    />
  );
}

function Content({
  children,
  ...props
}: ComponentProps<typeof TamaDialog.Content> & { children: ReactNode }) {
  return (
    <TamaDialog.Content
      backgroundColor="$backgroundElevated"
      borderRadius="$xl"
      padding="$6"
      gap="$3"
      transition="quick"
      enterStyle={{ opacity: 0, scale: 0.96, y: 8 }}
      exitStyle={{ opacity: 0, scale: 0.96, y: 8 }}
      maxWidth={520}
      width="100%"
      {...props}
    >
      {children}
    </TamaDialog.Content>
  );
}

function Title(props: ComponentProps<typeof TamaDialog.Title>) {
  return <TamaDialog.Title color="$color" fontSize={18} fontWeight="600" {...props} />; // 18 has no exact token (between $bodyLg=17 and $h2=20); kept numeric for visual fidelity
}

function Description(props: ComponentProps<typeof TamaDialog.Description>) {
  return <TamaDialog.Description color="$colorSecondary" fontSize="$bodySm" {...props} />;
}

const Close = TamaDialog.Close;

export const PekuloDialog = Object.assign(Root, {
  Trigger,
  Portal,
  Overlay,
  Content,
  Title,
  Description,
  Close,
});
