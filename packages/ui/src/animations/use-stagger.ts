// packages/ui/src/animations/use-stagger.ts
// Computes per-item delays for a staggered list animation. Returns
// [0, delayMs, 2·delayMs, ...] under normal motion ; [0, 0, ...] under
// prefers-reduced-motion: reduce.
//
// The component consuming this hook applies the delays via Tamagui's
// `enterStyle` + `animation` props (animations-css driver).

import { useMemo, useSyncExternalStore } from "react";

function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false /* SSR-safe default */,
  );
}

export function useStagger(itemCount: number, delayMs = 40): number[] {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => {
    if (reduced) return Array.from({ length: itemCount }, () => 0);
    return Array.from({ length: itemCount }, (_, i) => i * delayMs);
  }, [itemCount, delayMs, reduced]);
}
