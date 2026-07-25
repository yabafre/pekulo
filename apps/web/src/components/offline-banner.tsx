"use client";

// Story 9-2 (FR-54, AC-6). Signal-gated: renders only while the browser reports
// offline, and only on the routes the cache actually covers. Styled with inline
// `style` on plain DOM rather than Tamagui, which is why it carries `font_body`
// — DS COLOUR vars are global, but `--f-family` only exists under Tamagui's
// font_* classes, and omitting it is what shipped the install banner in serif
// (lesson 2026-07-13).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { dashboardKeys } from "@/lib/zapaction/keys";
import { isOfflineRoute } from "@/lib/offline/routes";
import { OFFLINE_MAX_AGE_MS } from "@/lib/offline/query-persister";

/** How often the age is recomputed while the banner is up. The copy is in whole
 * minutes, so half a minute keeps it from ever being visibly wrong. */
const AGE_TICK_MS = 30_000;

/** Set on <html> while the banner is up. The cap-shell header is a NORMAL FLOW
 * element (bento.module.css `.header`) and this banner is position:fixed, so
 * without an offset the banner sits on top of it — measured on a 390px viewport
 * it covered the Cap / Patrimoine tabs and every header button. */
export const OFFLINE_BANNER_OPEN_CLASS = "pekulo-offline-banner-open";

// Injected as a plain <style> — the CSP retains style-src 'unsafe-inline', the
// same pattern install-prompt.tsx uses. The offset is the banner's own height
// (38px) plus its 12px inset and a 12px gap below it.
const BANNER_CSS = `
.${OFFLINE_BANNER_OPEN_CLASS} body {
  padding-top: calc(env(safe-area-inset-top, 0px) + 62px);
}
`;

export function OfflineBanner() {
  const t = useTranslations("offline");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  // Start hidden so the server render and the first client paint agree — the
  // effect is the only thing that may reveal the banner (lesson 2026-05-20).
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Only the three cached screens can honestly claim "read-only data": the rest
  // have no snapshot and no cached shell. `/login` in particular has no data at
  // all, and the component mounts in the ROOT layout so it reaches every route.
  const visible = offline && isOfflineRoute(pathname);

  useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    root.classList.add(OFFLINE_BANNER_OPEN_CLASS);
    return () => root.classList.remove(OFFLINE_BANNER_OPEN_CLASS);
  }, [visible]);

  // The age is read from `Date.now()` at render time, and nothing else
  // re-renders this component while the user simply sits there — so without a
  // tick a 45-minute-old snapshot kept reporting the age it had on arrival.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((n) => n + 1), AGE_TICK_MS);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  // The overview query is the one every cap screen depends on, so its
  // dataUpdatedAt is the honest age of what the user is looking at.
  const updatedAt = queryClient.getQueryState(dashboardKeys.overview())?.dataUpdatedAt ?? 0;
  const age = updatedAt > 0 ? Date.now() - updatedAt : null;
  // NFR-20 caps the snapshot at 60 minutes. That ceiling was enforced only when
  // restoring; a tab left open offline sailed past it, still showing figures.
  const expired = age !== null && age > OFFLINE_MAX_AGE_MS;
  const minutes = age !== null && !expired ? Math.max(0, Math.round(age / 60_000)) : null;

  return (
    <>
      <style>{BANNER_CSS}</style>
      <div
        role="status"
        aria-live="polite"
        aria-label={t("aria")}
        className="font_body"
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          zIndex: 60,
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 14,
          background: "var(--backgroundElevated)",
          color: "var(--color)",
          border: "1px solid color-mix(in srgb, var(--color) 12%, transparent)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          fontSize: 13,
        }}
      >
        <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
          <WifiOff size={16} />
        </span>
        <span style={{ minWidth: 0 }}>
          {expired ? t("expired") : minutes === null ? t("title") : t("age", { minutes })}
        </span>
      </div>
    </>
  );
}
