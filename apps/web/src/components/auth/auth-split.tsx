"use client";

// apps/web/src/components/auth/auth-split.tsx
// Split-screen auth shell (story 8-1 visual refonte, cloudvault-inspired):
// the form sits in the left half, an ambient generative FallingPattern fills
// the right half on ≥lg screens (v5 media `$lg` = min-width 1024), fading in
// from the centre via a left-edge mask. Below lg the pattern is hidden and the
// form takes the full width — centred on pure #000 either way.

import type { ReactNode } from "react";
import { View } from "@pekulo/ui/client";
import { FallingPattern } from "./falling-pattern";

export function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <View flexDirection="row" minHeight="100dvh" width="100%" backgroundColor="$background">
      <View
        flex={1}
        alignItems="center"
        justifyContent="center"
        paddingHorizontal="$4"
        paddingVertical="$10"
      >
        {children}
      </View>
      <View display="none" width="50%" position="relative" $lg={{ display: "flex" }}>
        <FallingPattern
          color="#ededed"
          speed={0.8}
          style={{
            maskImage: "linear-gradient(to right, transparent, #000 38%)",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 38%)",
          }}
        />
      </View>
    </View>
  );
}
