"use client";

// Story 9-2 (FR-54, AC-6). Signal-gated: renders only while the browser reports
// offline, and only on the routes the cache actually covers. Styled with inline
// `style` on plain DOM rather than Tamagui, which is why it carries `font_body`
// — DS COLOUR vars are global, but `--f-family` only exists under Tamagui's
// font_* classes, and omitting it is what shipped the install banner in serif
// (lesson 2026-07-13).
import { useEffect, useRef, useState } from "react";
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
/** Set on <html> from the banner's MEASURED height. A constant was tried first
 * and was wrong the moment the copy wrapped: 62px was measured against the
 * one-line English string, but in fr at 375px the banner takes two lines and
 * its bottom (64px) crossed the header's top (62px). Any longer locale or a
 * larger user font size reproduces it, so the offset follows the element. */
export const OFFLINE_BANNER_OFFSET_VAR = "--pekulo-offline-banner-offset";
/** Banner top inset + the gap below it. */
const BANNER_GAP = 24;

// Injected as a plain <style> — the CSP retains style-src 'unsafe-inline', the
// same pattern install-prompt.tsx uses.
//
// The background is not decoration. `html` and `body` are both transparent in
// this app (the only opaque surface is bento's `.shell`), so padding `body`
// slides that surface down and uncovers the browser's default WHITE canvas —
// a full-width white band above a dark app, seam contrast 21:1. Painting the
// offset band is part of opening it.
const BANNER_CSS = `
.${OFFLINE_BANNER_OPEN_CLASS},
.${OFFLINE_BANNER_OPEN_CLASS} body {
  background: var(--background);
}
.${OFFLINE_BANNER_OPEN_CLASS} body {
  padding-top: calc(env(safe-area-inset-top, 0px) + var(${OFFLINE_BANNER_OFFSET_VAR}, 62px));
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

  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    root.classList.add(OFFLINE_BANNER_OPEN_CLASS);

    // Follow the banner's real height rather than trusting a constant: the copy
    // wraps at narrow widths in the longer locales, and a fixed offset lets the
    // banner sit on the header exactly when that happens.
    const applyOffset = () => {
      const height = bannerRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty(OFFLINE_BANNER_OFFSET_VAR, `${Math.round(height) + BANNER_GAP}px`);
    };
    applyOffset();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applyOffset);
    if (observer && bannerRef.current) observer.observe(bannerRef.current);
    window.addEventListener("resize", applyOffset);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", applyOffset);
      root.classList.remove(OFFLINE_BANNER_OPEN_CLASS);
      root.style.removeProperty(OFFLINE_BANNER_OFFSET_VAR);
    };
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
        ref={bannerRef}
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
          // 12 % read as ~1.3:1 against the light theme, where the banner's
          // --backgroundElevated equals the page background and the border is
          // the only thing separating the two surfaces. The shadow is tuned for
          // dark and all but vanishes there.
          border: "1px solid color-mix(in srgb, var(--color) 22%, transparent)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.28)",
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
