"use client";

import { useEffect } from "react";

// Dev-only React Grab loader (visual inspector for the agent workflow).
//
// Loads the PINNED, pre-built CDN GLOBAL build (`index.global.js`) — react-grab's
// official Next.js pattern — instead of a Turbopack-bundled `import("react-grab")`.
// WHY the switch (aped-debug 2026-06-03): the bundled import routes the whole
// react-grab library (a large instrumentation package) AND its per-component
// source-map resolution through the Turbopack dev server. On a heavy route that
// pegged `next` to ~7 cores (sampling showed the dev server's worker threads
// hot — Turbopack bundling/source-mapping react-grab, not app render work). The
// IIFE global build runs ENTIRELY in the browser, outside the bundler, so the
// dev server does no react-grab work. The version is PINNED (no `@latest`), and
// the dev CSP allows unpkg only in development (`headers.ts`).
//
// Injected client-side after mount (dev only) so a production build never adds
// the tag. Renders nothing.
const REACT_GRAB_SRC = "https://unpkg.com/react-grab@0.1.44/dist/index.global.js";

export function ReactGrabDev(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (document.querySelector(`script[data-react-grab]`)) return;
    const script = document.createElement("script");
    script.src = REACT_GRAB_SRC;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.dataset.reactGrab = "1";
    document.body.appendChild(script);
  }, []);
  return null;
}
