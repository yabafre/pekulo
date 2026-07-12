"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, X } from "lucide-react";
import { PekuloButton } from "@pekulo/ui";

const DISMISS_KEY = "pekulo:install-dismissed";

// `beforeinstallprompt` is a non-standard event absent from the DOM lib typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
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
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

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

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  return (
    <div
      role="dialog"
      aria-label={t("aria")}
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        zIndex: 50,
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 16,
        background: "var(--background)",
        color: "var(--color)",
        border: "1px solid color-mix(in srgb, var(--color) 12%, transparent)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
    >
      <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
        {iosHint ? <Share size={20} /> : <Download size={20} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t("title")}</p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          {iosHint ? t("iosHint") : t("body")}
        </p>
      </div>
      {deferred ? (
        <PekuloButton variant="default" onClick={install}>
          {t("cta")}
        </PekuloButton>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        style={{
          display: "flex",
          flexShrink: 0,
          border: "none",
          background: "transparent",
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
          padding: 4,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
