"use client";

// Story 9-2 (FR-54, ADR-0018). Next 16 has no native service-worker route, so
// registration is manual (Next PWA guide, § Creating a Service Worker).
// Production only: in dev the worker would cache Turbopack's HMR documents and
// shadow every subsequent edit.
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // A worker registered by an earlier production run on this origin serves
      // /_next/static cache-first — stale Turbopack chunks surface as "module
      // factory is not available". Drop the worker AND its shell cache.
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations?.()
          .then((registrations) => {
            for (const registration of registrations) {
              void registration.unregister();
            }
          })
          .catch(() => {
            // Unregister errors are non-fatal
          });
      }
      if (typeof caches !== "undefined") {
        void caches
          .keys()
          .then((names) =>
            Promise.all(
              names.filter((n) => n.startsWith("pekulo-shell")).map((n) => caches.delete(n)),
            ),
          )
          .catch(() => {
            // Cache API unavailable — nothing to purge
          });
      }
      return;
    }
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
