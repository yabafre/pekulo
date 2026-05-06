// apps/web/src/app/(spike)/tamagui-spike/layout.tsx
// Server Component. Wraps the spike subtree with the single Tamagui client
// provider. NO 'use client' here — this file MUST stay an RSC.

import type { ReactNode } from "react";

import { PekuloTamaguiProvider } from "./provider";

export default function TamaguiSpikeLayout({ children }: { children: ReactNode }) {
  return <PekuloTamaguiProvider>{children}</PekuloTamaguiProvider>;
}
