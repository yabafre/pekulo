"use client";

// apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.tsx
// Story 11-1 (FR-49). The download is a plain authenticated GET to the
// same-origin proxy — the browser handles it natively via the anchor's
// `download` attribute plus the proxy's Content-Disposition header. No oRPC
// call is made from this component, so ADR-0010's hook/server-action triad
// does not apply (it governs oRPC calls, of which this makes none).
//
// The label rides a Tamagui <Text>, not the bare <a>: `--f-family` is scoped
// to Tamagui's `font_*` classes, so raw DOM text inside a View renders in the
// browser-default serif (lesson 2026-07-13). Same shape as
// _llm/_components/llm-activity-log-link.tsx.
import { Download } from "lucide-react";
import { PekuloSettingRow } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";

export interface ExportDataRowProps {
  label: string;
  sub: string;
  action: string;
}

export function ExportDataRow({ label, sub, action }: ExportDataRowProps) {
  return (
    <PekuloSettingRow
      label={label}
      sub={sub}
      action={
        <a
          href="/v1/export"
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <Download size={14} strokeWidth={2} aria-hidden />
          <Text color="$colorSecondary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
            {action}
          </Text>
        </a>
      }
    />
  );
}
