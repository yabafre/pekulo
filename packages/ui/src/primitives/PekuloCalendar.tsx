"use client";

// PekuloCalendar — Pekulo-themed wrapper around react-day-picker (v10).
// TR-strict month grid + chevron nav. DayPicker is className-driven
// internally; we override surface tokens via inline CSS so the consumer
// can still pass mode="single"/"range"/"multiple", selected, onSelect.
//
// API parity with shadcn's `Calendar`:
//   <PekuloCalendar mode="single" selected={date} onSelect={setDate} />
//
// Tokens note: the CALENDAR_THEME_CSS string below hard-codes a handful
// of RDP-internal magic numbers (8px day-button radius, 36px cell size,
// 12px weekday padding, 9999px nav-button radius). These are sub-token
// values dictated by react-day-picker's `--rdp-*` CSS vars + the
// month-grid geometry; Pekulo doesn't expose a matching token scale
// (no `$radiusXs`=4 or `$spacing[2.5]`=10), and tokenizing them would
// shift the magic into a new RDP-specific category that no other
// primitive consumes. Container-level surface props (backgroundColor,
// borderRadius, padding) are tokenised below; the per-element CSS
// values stay numeric and intentional.

import { DayPicker, type DayPickerProps } from "react-day-picker";
import type { CSSProperties } from "react";
import { pekuloRadius, pekuloSpacing } from "../tokens";

const CALENDAR_THEME_CSS = `
.pekulo-calendar {
  --rdp-accent-color: var(--color);
  --rdp-accent-background-color: var(--backgroundMuted);
  --rdp-background-color: var(--background);
  --rdp-cell-size: 36px;
  --rdp-day_button-border-radius: 8px;
  --rdp-day_button-width: 36px;
  --rdp-day_button-height: 36px;
  font-family: inherit;
  color: var(--color);
}
/* Layout — we don't import react-day-picker's base CSS, so we provide
 * the structural rules ourselves (months row, weekday grid, table
 * collapse). Without these the months render as block-level stacked
 * vertically — broken for range mode with 2 months side-by-side. */
/* .rdp-nav is a sibling of all months at the .rdp-months level (NOT
 * inside each month). Make .rdp-months the positioned ancestor so the
 * nav can be absolutely positioned across the whole months container --
 * prev on far-left, next on far-right, single shared set of chevrons
 * for both months in range mode. */
.pekulo-calendar .rdp-months {
  display: flex;
  flex-direction: row;
  gap: 16px;
  flex-wrap: wrap;
  position: relative;
  padding-top: 32px;
}
.pekulo-calendar .rdp-month {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pekulo-calendar .rdp-month_caption {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
}
.pekulo-calendar .rdp-nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  pointer-events: none;
  z-index: 1;
}
.pekulo-calendar .rdp-button_previous,
.pekulo-calendar .rdp-button_next {
  pointer-events: auto;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: transparent;
  border: 0;
  color: var(--colorTertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms, color 150ms;
}
.pekulo-calendar .rdp-button_previous:hover:not([disabled]),
.pekulo-calendar .rdp-button_next:hover:not([disabled]) {
  background: var(--backgroundMuted);
  color: var(--color);
}
.pekulo-calendar .rdp-button_previous:focus-visible,
.pekulo-calendar .rdp-button_next:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
.pekulo-calendar .rdp-button_previous[disabled],
.pekulo-calendar .rdp-button_next[disabled] {
  opacity: 0.3;
  cursor: not-allowed;
}
.pekulo-calendar .rdp-chevron {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.pekulo-calendar .rdp-month_grid,
.pekulo-calendar .rdp-table {
  border-collapse: collapse;
  width: 100%;
}
.pekulo-calendar .rdp-weekdays {
  display: table-row;
}
.pekulo-calendar .rdp-weekday {
  display: table-cell;
  text-align: center;
  padding: 4px 0;
}
.pekulo-calendar .rdp-weeks {
  display: table-row-group;
}
.pekulo-calendar .rdp-week {
  display: table-row;
}
.pekulo-calendar .rdp-day {
  display: table-cell;
  text-align: center;
  padding: 2px 0;
}
.pekulo-calendar .rdp-day_button {
  color: var(--color);
  background: transparent;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pekulo-calendar .rdp-day_button:hover:not([disabled]) {
  background: var(--backgroundMuted);
}
.pekulo-calendar .rdp-day_button:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
.pekulo-calendar .rdp-day.rdp-selected .rdp-day_button {
  background: var(--color);
  color: var(--colorOnAccent);
}
.pekulo-calendar .rdp-day.rdp-today .rdp-day_button {
  font-weight: 600;
}
.pekulo-calendar .rdp-day.rdp-outside .rdp-day_button {
  color: var(--colorTertiary);
  opacity: 0.5;
}
.pekulo-calendar .rdp-day.rdp-disabled .rdp-day_button {
  cursor: not-allowed;
  opacity: 0.4;
}
.pekulo-calendar .rdp-weekday {
  color: var(--colorTertiary);
  font-size: 12px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.pekulo-calendar .rdp-month_caption {
  font-size: 14px;
  font-weight: 500;
  color: var(--color);
  padding: 4px 0;
}
.pekulo-calendar .rdp-nav button {
  background: transparent;
  border: 0;
  color: var(--colorTertiary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pekulo-calendar .rdp-nav button:hover {
  background: var(--backgroundMuted);
  color: var(--color);
}
`;

const containerStyle: CSSProperties = {
  backgroundColor: "var(--backgroundCard)",
  borderRadius: pekuloRadius.lg,
  padding: pekuloSpacing[3],
};

export type PekuloCalendarProps = DayPickerProps;

export function PekuloCalendar(props: PekuloCalendarProps) {
  return (
    <>
      <style>{CALENDAR_THEME_CSS}</style>
      <div data-slot="calendar" className="pekulo-calendar" style={containerStyle}>
        <DayPicker showOutsideDays {...props} />
      </div>
    </>
  );
}
