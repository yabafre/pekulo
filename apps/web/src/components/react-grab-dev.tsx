"use client";

import { useEffect } from "react";

// Dev-only React Grab loader (visual inspector for the agent workflow).
// Loads the PINNED npm package (apps/web devDependency) from our own bundle —
// NOT the unversioned `//unpkg.com/react-grab@latest` CDN script, which pulled
// an uncontrolled newer build into the dev browser and forced unpkg into the CSP.
//
// The `process.env.NODE_ENV` guard sits INSIDE the effect so a production build
// statically eliminates the dynamic import (Next replaces NODE_ENV → dead code
// → react-grab is never resolved/bundled in prod). This is react-grab's own
// documented Webpack pattern. Renders nothing.
export function ReactGrabDev(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void import("react-grab");
  }, []);
  return null;
}
