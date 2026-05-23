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

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { PekuloCalendar } from "./PekuloCalendar";
import { PekuloPopover } from "./PekuloPopover";
import { pekuloFontSizes } from "../tokens";

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

  // Guard onOpenChange — in range mode, Tamagui's Popover fires a
  // spurious close on day_button clicks (the dismissable layer runs on
  // pointerdown in the capture phase, BEFORE react-day-picker's click
  // handler reaches onSelect). A ref-based guard reading the current
  // range value loses the race because the ref is still pre-click when
  // dismiss fires.
  //
  // Solution: defer the close one macrotask via setTimeout(0). React
  // flushes the click-handler chain (including react-day-picker →
  // onSelect → onChange) in the current macrotask; setTimeout(0)'s
  // callback runs in the next one, AFTER onSelect has settled the
  // range. If the range turned out to be incomplete (just-set `from`,
  // no `to` yet), onSelect cancels the pending close via the same
  // timer ref. Genuine outside-clicks / Escape / trigger-press fire
  // dismiss WITHOUT a follow-up onSelect → the timer is never cancelled
  // → popover closes after one tick (imperceptible).
  const pendingCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingCloseRef.current !== null) {
        clearTimeout(pendingCloseRef.current);
      }
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (next || props.mode !== "range") {
      setOpen(next);
      return;
    }
    // Cancel any previously-pending close before scheduling a new one.
    if (pendingCloseRef.current !== null) {
      clearTimeout(pendingCloseRef.current);
    }
    pendingCloseRef.current = setTimeout(() => {
      pendingCloseRef.current = null;
      setOpen(false);
    }, 0);
  };

  return (
    <PekuloPopover open={open} onOpenChange={handleOpenChange}>
      <PekuloPopover.Trigger
        id={props.id}
        aria-label="Sélectionner une date"
        // PekuloPopover.Trigger now ships sensible row-flex defaults
        // (display:inline-flex + flex-direction:row + alignItems:center)
        // so consumers don't have to fight Tamagui's `is_View` column
        // default. Style below only overrides what's specific to the
        // DatePicker pill (width, padding, border, colors, etc.).
        style={{
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
          fontSize: pekuloFontSizes.bodySm,
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
            // min={1} forces react-day-picker v10's `addToRange` to leave
            // `to` undefined on the FIRST click of an empty range. Without
            // it (default min=0), v10 sets `to: from` on the first click —
            // i.e. an empty-state click yields a "complete" single-day
            // range, which our completion check below misreads as a
            // legitimate close trigger. min=1 mirrors the standard
            // range-picker UX: click #1 → from, click #2 → to.
            min={1}
            // resetOnSelect={true} makes a click on an already-complete
            // range start a fresh range from the clicked date instead of
            // calling addToRange (which would move `to` to the click,
            // collapsing the existing range to {from, clicked}). Without
            // this, clicking inside `{from: 5, to: 20}` on day 10
            // produces `{from: 5, to: 10}` — counter-intuitive when the
            // clicked date is closer to `from` than `to`. With reset,
            // the same click produces `{from: 10, to: undefined}` and
            // the user picks the new `to` on the next click. See
            // useRange.js:29-35 — the reset branch bypasses addToRange
            // when `hasFullRange || !selected.from`.
            resetOnSelect={true}
            onSelect={(r) => {
              props.onChange(r);
              if (r?.from && r?.to) {
                // Range complete — let the pending close (if any) win,
                // OR fire close ourselves if no dismiss was queued.
                setOpen(false);
                return;
              }
              // Range incomplete after this click — cancel any close
              // pending from Tamagui's spurious pointerdown dismiss.
              if (pendingCloseRef.current !== null) {
                clearTimeout(pendingCloseRef.current);
                pendingCloseRef.current = null;
              }
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
