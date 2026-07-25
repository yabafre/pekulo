"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, X } from "lucide-react";
import { PekuloButton } from "@pekulo/ui";

const DISMISS_KEY = "pekulo:install-dismissed";

// The banner is fixed to the bottom. On mobile (< Pekulo `lg` = 1024px) the app
// shell renders PekuloMobileBottomNav (fixed, bottom 0, ~64px, zIndex 50) on the
// very page this banner targets (/dashboard = manifest start_url), so the banner
// must clear the nav or it covers its tap targets. A media query lifts it above
// the nav on mobile; on desktop (no nav) it sits at the normal 16px inset. zIndex
// 60 keeps it above the nav's 50. Injected as a plain <style> (CSP retains
// style-src 'unsafe-inline') — same pattern PekuloButton uses.
const BANNER_CSS = `
.pekulo-install-banner { bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); }
@media (max-width: 1023.98px) {
  .pekulo-install-banner { bottom: calc(env(safe-area-inset-bottom, 0px) + 80px); }
}
`;

// `beforeinstallprompt` is a non-standard event absent from the DOM lib typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// localStorage throws (SecurityError) when storage is blocked — Safari "Block All
// Cookies", locked-down enterprise webviews. This component mounts in the root
// layout with no error boundary above it, so an unguarded access would blank the
// whole app. Guard both directions (mirrors the layout's inline theme script).
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // storage blocked — the banner stays hidden for this session anyway.
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ Safari reports a desktop macOS UA with no "iPad" token; detect the
  // touch-capable Macintosh so iPad users still get the manual Share hint.
  const iPadOsDesktop = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOsDesktop;
}

export function InstallPrompt() {
  const t = useTranslations("install");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  // Start hidden so the server render AND the first client paint both render
  // null — no isLoading-style hydration mismatch (lesson 2026-05-20). The
  // effect is the only place that decides to show the banner.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (readDismissed()) return;

    const onPrompt = (event: Event) => {
      // Stop Chrome's mini-infobar so we can show our own banner instead.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — surface the manual hint.
    if (isIos()) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!deferred && !iosHint)) return null;

  // Prefer the Android install UI when a real prompt is deferred; only fall back
  // to the iOS hint when there is no installable event (keeps the two paths from
  // ever rendering a Share icon next to an Install button).
  const showIosHint = iosHint && !deferred;

  const dismiss = () => {
    persistDismissed();
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // Persist ONLY on a real install — a declined OS prompt hides the banner
      // for this session but lets it return on a later visit (AC-3 persists only
      // the banner's own dismissal, not an OS-level decline).
      if (outcome === "accepted") persistDismissed();
    } catch {
      // prompt() can reject (event already consumed / missing user gesture) —
      // swallow so the click handler never leaks an unhandled rejection.
    } finally {
      setDeferred(null);
      setHidden(true);
    }
  };

  return (
    <>
      <style>{BANNER_CSS}</style>
      <div
        // `font_body` pulls the DS font (Geist via --f-family) onto this plain-DOM
        // banner — Tamagui only applies the font to its own font-classed elements,
        // so a raw <div>/<p> would otherwise fall back to the browser default.
        className="pekulo-install-banner font_body"
        role="dialog"
        aria-label={t("aria")}
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          zIndex: 60,
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: 16,
          background: "var(--backgroundElevated)",
          color: "var(--color)",
          border: "1px solid color-mix(in srgb, var(--color) 12%, transparent)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
          {showIosHint ? <Share size={20} /> : <Download size={20} />}
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{t("title")}</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, opacity: 0.7 }}>
            {showIosHint ? t("iosHint") : t("body")}
          </p>
        </div>
        {deferred ? (
          <PekuloButton variant="default" size="lg" style={{ minHeight: 44 }} onClick={install}>
            {t("cta")}
          </PekuloButton>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            color: "inherit",
            opacity: 0.6,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>
    </>
  );
}
