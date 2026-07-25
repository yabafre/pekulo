"use client";

// Story 9-2 (FR-54, ADR-0018). Next 16 has no native service-worker route, so
// registration is manual (Next PWA guide, § Creating a Service Worker).
// Production only: in dev the worker would cache Turbopack's HMR documents and
// shadow every subsequent edit.
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration must never break the page: the app simply
        // stays online-only.
      });
    };

    // Registering during load competes with the first paint for bandwidth.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
