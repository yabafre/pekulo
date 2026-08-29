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
// browser-default serif (lesson 2026-07-13).
//
// The icon lives INSIDE that <Text> so it inherits its colour via
// `currentColor` — same shape as _account/_components/sign-out-button.tsx.
// As a sibling it inherited nothing instead: reset.css sets `a { color:
// inherit }`, nothing up the tree declares a colour, and no `color-scheme` is
// set anywhere, so lucide's `stroke="currentColor"` resolved to the UA default
// black on the #0a0a0a card — about 1.03:1. Nesting also keeps the hover
// transition in sync between glyph and label. (aped-review, story 11-1.)
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
          // The visible word is « Exporter »; out of context — a screen-reader
          // links rotor, or beside story 11-2's identically shaped
          // « Supprimer » row — that says nothing. The full row label carries
          // the meaning, and it contains the visible text, so WCAG 2.5.3
          // (Label in Name) holds.
          aria-label={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          <Text
            display="flex"
            flexDirection="row"
            alignItems="center"
            gap="$2"
            color="$colorSecondary"
            fontSize="$caption"
            hoverStyle={{ color: "$color" }}
          >
            <Download size={14} strokeWidth={2} color="currentColor" aria-hidden />
            {action}
          </Text>
        </a>
      }
    />
  );
}
