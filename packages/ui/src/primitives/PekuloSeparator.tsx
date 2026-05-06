"use client";

import { Separator as TamaSeparator } from "@tamagui/separator";
import type { ComponentProps } from "react";

export function PekuloSeparator(props: ComponentProps<typeof TamaSeparator>) {
  return <TamaSeparator borderColor="$borderDefault" opacity={1} {...props} />;
}
