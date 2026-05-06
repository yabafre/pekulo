"use client";

import { Progress as TamaProgress, type ProgressProps } from "@tamagui/progress";
import type { ComponentProps } from "react";

function Root(props: ProgressProps) {
  return (
    <TamaProgress
      backgroundColor="$backgroundMuted"
      borderRadius={9999}
      height={6}
      overflow="hidden"
      {...props}
    />
  );
}

function Indicator(props: ComponentProps<typeof TamaProgress.Indicator>) {
  return <TamaProgress.Indicator backgroundColor="$color" transition="quick" {...props} />;
}

export const PekuloProgress = Object.assign(Root, { Indicator });
