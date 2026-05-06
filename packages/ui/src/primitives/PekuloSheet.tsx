"use client";

// packages/ui/src/primitives/PekuloSheet.tsx
// Pekulo-themed wrapper around @tamagui/sheet. Bottom sheet for mobile with
// multiple snap points. Compound: PekuloSheet (root) + .Frame + .Handle
// + .Overlay.

import { Sheet as TamaSheet, type SheetProps } from "@tamagui/sheet";
import type { ComponentProps, ReactNode } from "react";

function Root({
  snapPoints = [85, 50, 25],
  dismissOnSnapToBottom = true,
  ...props
}: SheetProps & { children: ReactNode }) {
  return (
    <TamaSheet
      modal
      transition="medium"
      snapPoints={snapPoints}
      dismissOnSnapToBottom={dismissOnSnapToBottom}
      {...props}
    />
  );
}

function Overlay(props: ComponentProps<typeof TamaSheet.Overlay>) {
  return (
    <TamaSheet.Overlay
      backgroundColor="rgba(0, 0, 0, 0.6)"
      transition="quick"
      enterStyle={{ opacity: 0 }}
      exitStyle={{ opacity: 0 }}
      {...props}
    />
  );
}

function Frame({
  children,
  ...props
}: ComponentProps<typeof TamaSheet.Frame> & { children: ReactNode }) {
  return (
    <TamaSheet.Frame
      backgroundColor="$backgroundElevated"
      borderTopLeftRadius={20}
      borderTopRightRadius={20}
      padding={20}
      gap={12}
      {...props}
    >
      {children}
    </TamaSheet.Frame>
  );
}

function Handle(props: ComponentProps<typeof TamaSheet.Handle>) {
  return (
    <TamaSheet.Handle
      backgroundColor="$colorTertiary"
      opacity={0.5}
      height={4}
      width={48}
      borderRadius={9999}
      alignSelf="center"
      marginBottom={12}
      {...props}
    />
  );
}

export const PekuloSheet = Object.assign(Root, { Overlay, Frame, Handle });
