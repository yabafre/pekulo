"use client";

// packages/ui/src/animations/use-count-up.ts
// rAF-based count-up. Replaces framer-motion's useMotionValue + useSpring.
// Returns the currently-animated number, ticking on requestAnimationFrame.
// Returns the target immediately when prefers-reduced-motion: reduce is set.
//
// Pure React + DOM ; no external deps.

import { useEffect, useRef, useState } from "react";

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Default 800. */
  durationMs?: number;
  /** Easing function (t in [0, 1] → eased t). Default: ease-out cubic. */
  easing?: (t: number) => number;
  /**
   * Animate from 0 → target on mount (the value "sweeps in"). Opt-in: when
   * omitted the value starts already at `target` and only animates on a
   * subsequent `target` change — the behaviour the other consumers (Hero,
   * CountUpEUR, CountUpPct) rely on. Honours prefers-reduced-motion (settles
   * at target, no sweep) and seeds the first paint at 0 → no flicker.
   */
  fromZero?: boolean;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(target: number, opts: UseCountUpOptions = {}): number {
  const { durationMs = 800, easing = easeOutCubic, fromZero = false } = opts;
  // First paint (and SSR) value: 0 when sweeping in with motion allowed, else
  // target. Seeding at 0 — rather than target → 0 → target — means the empty
  // ring renders first and only fills upward (no flicker).
  const [value, setValue] = useState(() => (fromZero && !prefersReducedMotion() ? 0 : target));
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }

    if (prefersReducedMotion()) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = easing(t);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        rafRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs, easing]);

  return value;
}
