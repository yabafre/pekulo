"use client";

import { useEffect } from "react";

// Dev-only React Grab loader (visual inspector for the agent workflow).
// Loads the PINNED npm package (apps/web devDependency) from our own bundle —
// NOT the unversioned `//unpkg.com/react-grab@latest` CDN script, which pulled
// an uncontrolled newer build into the dev browser and forced unpkg into the CSP.
//
// OPT-IN (off by default). React Grab instruments the WHOLE React tree and pulls
// per-component source-maps from the dev server, which pegs the `next` dev
// process to ~7 cores on a heavy route (aped-debug 2026-06-03 — the
// transactions-page "fan" culprit; the cost scaled with the 6-7 auto-applied
// rows). Enable it only when you need the inspector / react-grab MCP:
//   NEXT_PUBLIC_REACT_GRAB=1   (in .env.local, then restart `bun dev`)
//
// Both guards sit INSIDE the effect so a production build statically eliminates
// the dynamic import (Next replaces the env reads → dead code → react-grab is
// never resolved/bundled in prod). Renders nothing.
export function ReactGrabDev(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (process.env.NEXT_PUBLIC_REACT_GRAB !== "1") return;
    void import("react-grab");
  }, []);
  return null;
}
