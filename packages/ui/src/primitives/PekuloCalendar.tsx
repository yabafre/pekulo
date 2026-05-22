"use client";

// PekuloCalendar — Pekulo-themed wrapper around react-day-picker (v10).
// TR-strict month grid + chevron nav. DayPicker is className-driven
// internally; we override surface tokens via inline CSS so the consumer
// can still pass mode="single"/"range"/"multiple", selected, onSelect.
//
// API parity with shadcn's `Calendar`:
//   <PekuloCalendar mode="single" selected={date} onSelect={setDate} />

import { DayPicker, type DayPickerProps } from "react-day-picker";
import type { CSSProperties } from "react";

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
  borderRadius: 12,
  padding: 12,
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
