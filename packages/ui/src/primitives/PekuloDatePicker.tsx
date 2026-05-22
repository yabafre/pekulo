"use client";

// PekuloDatePicker — pre-composed primitive that wires PekuloPopover +
// PekuloCalendar + PekuloButton in the canonical "trigger pill + calendar
// popover" pattern. shadcn defers this composition to the consumer; we
// pre-bake it so consumers don't repeat the same 30 lines at every
// call site.
//
// Two API shapes:
//   - Single: <PekuloDatePicker value={d} onChange={setD} />
//   - Range:  <PekuloDatePicker mode="range" value={r} onChange={setR} />
//
// Custom trigger label: pass `formatLabel` for fr-FR or custom output.

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { PekuloCalendar } from "./PekuloCalendar";
import { PekuloPopover } from "./PekuloPopover";

const dateFmtFR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function defaultFormatSingle(d?: Date): string {
  if (!d) return "Choisir une date";
  return dateFmtFR.format(d);
}

function defaultFormatRange(r?: DateRange): string {
  if (!r?.from) return "Choisir une plage";
  if (!r.to) return dateFmtFR.format(r.from);
  return `${dateFmtFR.format(r.from)} → ${dateFmtFR.format(r.to)}`;
}

// ─── Single-mode ─────────────────────────────────────────────────────────

export interface PekuloDatePickerSingleProps {
  mode?: "single";
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  /** Format the trigger label. Default: fr-FR "1 janvier 2026". */
  formatLabel?: (d?: Date) => string;
  /** Width override (px or "auto"). Default 280. */
  width?: number | string;
  /** Disable the trigger. */
  disabled?: boolean;
  /** HTML id forwarded to the trigger button — enables `<label htmlFor>` association. */
  id?: string;
}

// ─── Range-mode ──────────────────────────────────────────────────────────

export interface PekuloDatePickerRangeProps {
  mode: "range";
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
  placeholder?: string;
  formatLabel?: (r?: DateRange) => string;
  width?: number | string;
  disabled?: boolean;
  /** Render N months side-by-side (range only). Default 2. */
  numberOfMonths?: number;
  /** HTML id forwarded to the trigger button — enables `<label htmlFor>` association. */
  id?: string;
}

export type PekuloDatePickerProps = PekuloDatePickerSingleProps | PekuloDatePickerRangeProps;

export function PekuloDatePicker(props: PekuloDatePickerProps) {
  const [open, setOpen] = useState(false);
  const width = props.width ?? 280;
  // Narrow the label resolution per mode so each branch keeps a strict
  // (Date) vs (DateRange) function signature — no `(DateRange & Date)`
  // intersection bleed.
  let label: string;
  if (props.mode === "range") {
    const fn = props.formatLabel ?? defaultFormatRange;
    label = fn(props.value);
  } else {
    const fn = props.formatLabel ?? defaultFormatSingle;
    label = fn(props.value);
  }

  return (
    <PekuloPopover open={open} onOpenChange={setOpen}>
      <PekuloPopover.Trigger
        id={props.id}
        aria-label="Sélectionner une date"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          width,
          justifyContent: "flex-start",
          padding: "0 12px",
          height: 32,
          backgroundColor: "transparent",
          color: "var(--color)",
          border: "1px solid var(--borderDefault)",
          borderRadius: 12,
          fontFamily: "inherit",
          fontSize: 14,
          fontWeight: 500,
          cursor: props.disabled ? "not-allowed" : "pointer",
          opacity: props.disabled ? 0.5 : 1,
        }}
        disabled={props.disabled}
      >
        <CalendarIcon size={14} aria-hidden={true} />
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      </PekuloPopover.Trigger>
      <PekuloPopover.Content>
        {props.mode === "range" ? (
          <PekuloCalendar
            mode="range"
            selected={props.value}
            onSelect={(r) => {
              props.onChange(r);
              if (r?.from && r?.to) setOpen(false);
            }}
            numberOfMonths={props.numberOfMonths ?? 2}
          />
        ) : (
          <PekuloCalendar
            mode="single"
            selected={props.value}
            onSelect={(d) => {
              props.onChange(d);
              setOpen(false);
            }}
          />
        )}
      </PekuloPopover.Content>
    </PekuloPopover>
  );
}

// Suppress unused param warning for placeholder (forwarded via defaults).
void defaultFormatSingle;
void defaultFormatRange;
