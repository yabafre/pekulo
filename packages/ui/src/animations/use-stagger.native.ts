// packages/ui/src/animations/use-stagger.native.ts
// React Native reduced-motion + stagger hooks backed by AccessibilityInfo.

import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(Boolean(enabled));
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (mounted) setReduced(Boolean(enabled));
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

export function useStagger(itemCount: number, delayMs = 40): number[] {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => {
    const count = Math.max(0, Math.trunc(itemCount));
    if (reduced) return Array.from({ length: count }, () => 0);
    return Array.from({ length: count }, (_, i) => i * delayMs);
  }, [itemCount, delayMs, reduced]);
}
