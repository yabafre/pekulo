"use client";

// apps/web/src/components/auth/falling-pattern.tsx
// Generative dot-matrix with isobar/contour wave bands that drift organically
// (sine interference → topographic field). Rendered via putImageData (one
// atomic blit, zero flicker) and disabled under prefers-reduced-motion.
// Decorative only: pointer-events none + aria-hidden. Ported from the cloudvault
// ux-preview to plain React + inline styles (no Tailwind on apps/web). Default
// colour is grayscale to honour the TR-strict discipline (chromatic accents
// stay reserved for perf deltas).
//
// PERF (it is a *background*, so it must stay cheap): the render is pinned to 1
// device pixel (no retina 4×-pixel blit), throttled to ~30fps (the field drifts
// slowly — 60fps is imperceptible here), and fully paused while the tab is
// hidden. These three together cut the main-thread + WindowServer compositing
// cost by an order of magnitude vs an unthrottled dpr-2 60fps loop.

import { useEffect, useRef, type CSSProperties } from "react";

const RENDER_DPR = 1; // pin to 1 device pixel — a faint background needs no retina density
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;

type FallingPatternProps = {
  color?: string;
  speed?: number;
  dotSize?: number;
  gap?: number;
  style?: CSSProperties;
};

export function FallingPattern({
  color = "#ededed",
  speed = 0.8,
  dotSize = 1.5,
  gap = 8,
  style,
}: FallingPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = RENDER_DPR;
    const hex = color.replace("#", "");
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let imgData: ImageData | null = null;
    let last = 0;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        imgData = null;
        return;
      }
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cols = Math.ceil(w / gap);
      rows = Math.ceil(h / gap);
      imgData = ctx.createImageData(canvas.width, canvas.height);
    };

    const setDot = (cx: number, cy: number, alpha: number) => {
      if (!imgData) return;
      const a = (alpha * 255) | 0;
      const sx = (cx * dpr) | 0;
      const sy = (cy * dpr) | 0;
      const ds = Math.max(1, (dotSize * dpr) | 0);
      const stride = canvas.width * 4;
      const data = imgData.data;

      for (let dy = 0; dy < ds; dy++) {
        const rowOff = (sy + dy) * stride;
        for (let dx = 0; dx < ds; dx++) {
          const i = rowOff + (sx + dx) * 4;
          data[i] = cr;
          data[i + 1] = cg;
          data[i + 2] = cb;
          data[i + 3] = a;
        }
      }
    };

    const draw = (ts: number) => {
      animRef.current = requestAnimationFrame(draw);
      // Throttle to TARGET_FPS — skip frames that arrive too soon.
      if (ts - last < FRAME_MS) return;
      last = ts;
      if (!imgData) return;

      const t = ts * 0.001 * speed;
      imgData.data.fill(0);

      for (let row = 0; row < rows; row++) {
        const py = row * gap;
        for (let col = 0; col < cols; col++) {
          const px = col * gap;

          const f1 =
            Math.sin(px * 0.006 + py * 0.004 + t * 0.5) +
            Math.sin(px * 0.004 - py * 0.006 + t * 0.3);
          const f2 =
            Math.sin(px * 0.009 + py * 0.007 - t * 0.4 + 1.5) +
            Math.sin(-px * 0.005 + py * 0.008 + t * 0.35 + 3.0);
          const f3 =
            Math.sin(px * 0.003 + py * 0.01 + t * 0.25 + 5.0) +
            Math.sin(px * 0.007 - py * 0.003 - t * 0.45 + 2.0);

          const field = f1 + f2 * 0.7 + f3 * 0.5;
          const contour = Math.sin(field * 2.5);
          const alpha = 0.12 + (contour * 0.5 + 0.5) * 0.43;

          setDot(px, py, alpha);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };

    const start = () => {
      cancelAnimationFrame(animRef.current);
      last = 0;
      animRef.current = requestAnimationFrame(draw);
    };
    const stop = () => cancelAnimationFrame(animRef.current);

    // Pause entirely while the tab is hidden — no point animating offscreen.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    start();

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [color, speed, dotSize, gap]);

  return (
    <div
      style={{ position: "relative", height: "100%", width: "100%", overflow: "hidden", ...style }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
