"use client";

// Story 9-2 (FR-54, AC-6). Signal-gated: renders only while the browser reports
// offline. Styled with inline `style` on plain DOM rather than Tamagui, which is
// why it carries `font_body` — DS COLOUR vars are global, but `--f-family` only
// exists under Tamagui's font_* classes, and omitting it is what shipped the
// install banner in serif (lesson 2026-07-13).
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { dashboardKeys } from "@/lib/zapaction/keys";

export function OfflineBanner() {
  const t = useTranslations("offline");
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

  if (!offline) return null;

  // The overview query is the one every cap screen depends on, so its
  // dataUpdatedAt is the honest age of what the user is looking at.
  const updatedAt = queryClient.getQueryState(dashboardKeys.overview())?.dataUpdatedAt ?? 0;
  const minutes = updatedAt > 0 ? Math.max(0, Math.round((Date.now() - updatedAt) / 60_000)) : null;

  return (
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
      <span style={{ minWidth: 0 }}>{minutes === null ? t("title") : t("age", { minutes })}</span>
    </div>
  );
}
