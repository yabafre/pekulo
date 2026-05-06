"use client";

import { Avatar as TamaAvatar, type AvatarProps } from "@tamagui/avatar";
import type { ComponentProps, ReactNode } from "react";

function Root({ size = 40, ...props }: AvatarProps & { size?: number; children: ReactNode }) {
  return <TamaAvatar size={size} circular {...props} />;
}

function Image(props: ComponentProps<typeof TamaAvatar.Image>) {
  return <TamaAvatar.Image accessibilityLabel="" {...props} />;
}

function Fallback({
  children,
  ...props
}: ComponentProps<typeof TamaAvatar.Fallback> & { children: ReactNode }) {
  return (
    <TamaAvatar.Fallback
      backgroundColor="$backgroundMuted"
      alignItems="center"
      justifyContent="center"
      {...props}
    >
      {children}
    </TamaAvatar.Fallback>
  );
}

export const PekuloAvatar = Object.assign(Root, { Image, Fallback });
