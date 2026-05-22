import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DateRange } from "react-day-picker";
import { renderWithTamagui } from "../../test/setup.tsx";

// Mock PekuloPopover so we can drive `onOpenChange` from the test without
// fighting Tamagui's portal + capture-phase dismissable in happy-dom.
// The mock exposes the latest props via `popoverMock.lastProps` and renders
// children inline (no portal) so the calendar mount survives the test
// render assertions.
const popoverMock = {
  lastProps: null as null | { open?: boolean; onOpenChange?: (next: boolean) => void },
};
vi.mock("./PekuloPopover", () => {
  function PekuloPopover(props: {
    open?: boolean;
    onOpenChange?: (next: boolean) => void;
    children?: unknown;
  }) {
    popoverMock.lastProps = { open: props.open, onOpenChange: props.onOpenChange };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <>{props.children as any}</>;
  }
  PekuloPopover.Trigger = (props: { children?: unknown }) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <>{props.children as any}</>
  );
  PekuloPopover.Content = (props: { children?: unknown }) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <>{props.children as any}</>
  );
  PekuloPopover.Arrow = () => null;
  PekuloPopover.Close = (props: { children?: unknown }) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <>{props.children as any}</>
  );
  return { PekuloPopover };
});

// Mock PekuloCalendar so we can call its `onSelect` directly from the test
// without simulating react-day-picker's full event chain. The mock exposes
// the latest `onSelect` via calendarMock.lastOnSelect.
const calendarMock = {
  lastOnSelect: null as null | ((value: Date | DateRange | undefined) => void),
  lastMode: null as null | string,
  lastMin: null as null | number,
  lastNumberOfMonths: null as null | number,
};
vi.mock("./PekuloCalendar", () => ({
  PekuloCalendar: (props: {
    mode: "single" | "range";
    min?: number;
    numberOfMonths?: number;
    onSelect?: (value: Date | DateRange | undefined) => void;
  }) => {
    calendarMock.lastMode = props.mode;
    calendarMock.lastOnSelect = props.onSelect ?? null;
    calendarMock.lastMin = props.min ?? null;
    calendarMock.lastNumberOfMonths = props.numberOfMonths ?? null;
    return <div data-testid="calendar-mock">{props.mode}</div>;
  },
}));

import { PekuloDatePicker } from "./PekuloDatePicker";

beforeEach(() => {
  popoverMock.lastProps = null;
  calendarMock.lastOnSelect = null;
  calendarMock.lastMode = null;
  calendarMock.lastMin = null;
  calendarMock.lastNumberOfMonths = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PekuloDatePicker — single mode", () => {
  test("renders trigger with default fr-FR placeholder when value is undefined", () => {
    const { getByText } = renderWithTamagui(
      <PekuloDatePicker value={undefined} onChange={() => {}} />,
    );
    expect(getByText("Choisir une date")).toBeInTheDocument();
    expect(calendarMock.lastMode).toBe("single");
  });

  test("formats the trigger label via Intl.DateTimeFormat when value is set", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    const { getByText } = renderWithTamagui(<PekuloDatePicker value={d} onChange={() => {}} />);
    // fr-FR long-month formatting — "15 janvier 2026" (with non-breaking space).
    expect(getByText(/15 janvier 2026/)).toBeInTheDocument();
  });

  test("onSelect fires onChange and closes popover synchronously (no defer)", () => {
    const onChange = vi.fn();
    renderWithTamagui(<PekuloDatePicker value={undefined} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(false);

    // Drive a day click via the mocked calendar.
    const picked = new Date("2026-01-15T12:00:00Z");
    calendarMock.lastOnSelect?.(picked);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(picked);
    // Single mode closes synchronously (no setTimeout defer needed).
    expect(popoverMock.lastProps?.open).toBe(false);
  });
});

describe("PekuloDatePicker — react-day-picker v10 first-click guard", () => {
  // react-day-picker v10's addToRange.js (line 19-22) with default min=0
  // sets `to: from` on the FIRST click of an empty range — yielding
  // {from: day, to: day} which our completion check would misread as a
  // legitimate "range complete, close popover" trigger. Passing min={1}
  // forces v10 to leave `to: undefined` on the first click, restoring
  // the expected click1=from / click2=to UX. This test pins the contract.
  test("range mode forwards min={1} to PekuloCalendar", () => {
    renderWithTamagui(<PekuloDatePicker mode="range" value={undefined} onChange={() => {}} />);
    expect(calendarMock.lastMode).toBe("range");
    expect(calendarMock.lastMin).toBe(1);
  });

  test("single mode does NOT forward min (default behaviour)", () => {
    renderWithTamagui(<PekuloDatePicker value={undefined} onChange={() => {}} />);
    expect(calendarMock.lastMode).toBe("single");
    expect(calendarMock.lastMin).toBeNull();
  });

  test("range mode default numberOfMonths is 2; consumer override wins", () => {
    const { rerender } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={undefined} onChange={() => {}} />,
    );
    expect(calendarMock.lastNumberOfMonths).toBe(2);

    rerender(
      <PekuloDatePicker mode="range" value={undefined} onChange={() => {}} numberOfMonths={3} />,
    );
    expect(calendarMock.lastNumberOfMonths).toBe(3);
  });
});

describe("PekuloDatePicker — range mode close-on-end-date discipline", () => {
  test("first click (from only) — popover STAYS OPEN", () => {
    let value: DateRange | undefined = undefined;
    const onChange = vi.fn((next?: DateRange) => {
      value = next;
    });
    const { rerender } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={value} onChange={onChange} />,
    );

    // Simulate the user opening the popover by clicking the trigger:
    // Tamagui would call onOpenChange(true). PekuloDatePicker has no defer
    // on opens, so popoverMock.lastProps.open flips to true immediately.
    popoverMock.lastProps?.onOpenChange?.(true);
    rerender(<PekuloDatePicker mode="range" value={value} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(true);

    // Simulate Tamagui's spurious dismiss firing during pointerdown
    // capture-phase BEFORE react-day-picker reaches onSelect:
    popoverMock.lastProps?.onOpenChange?.(false);
    // setOpen(false) has NOT fired yet — it's deferred via setTimeout(0).
    expect(popoverMock.lastProps?.open).toBe(true);

    // Now onSelect fires (this is the real ordering: dismiss on
    // pointerdown → onSelect on click → both within the same macrotask).
    calendarMock.lastOnSelect?.({ from: new Date("2026-01-15"), to: undefined });
    expect(onChange).toHaveBeenCalledWith({ from: new Date("2026-01-15"), to: undefined });

    // Flush the deferred close timer. Because onSelect cancelled the
    // pending timer (range incomplete: from set, to undefined), the
    // popover must STAY OPEN.
    vi.runAllTimers();
    rerender(<PekuloDatePicker mode="range" value={value} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(true);
  });

  test("second click (to set) — popover CLOSES", () => {
    let value: DateRange | undefined = { from: new Date("2026-01-15"), to: undefined };
    const onChange = vi.fn((next?: DateRange) => {
      value = next;
    });
    const { rerender } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={value} onChange={onChange} />,
    );

    // Open the popover.
    popoverMock.lastProps?.onOpenChange?.(true);
    rerender(<PekuloDatePicker mode="range" value={value} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(true);

    // Tamagui's spurious dismiss fires.
    popoverMock.lastProps?.onOpenChange?.(false);

    // onSelect completes the range.
    calendarMock.lastOnSelect?.({
      from: new Date("2026-01-15"),
      to: new Date("2026-01-22"),
    });
    expect(onChange).toHaveBeenCalledWith({
      from: new Date("2026-01-15"),
      to: new Date("2026-01-22"),
    });

    // onSelect fired setOpen(false) directly — popover should be closed.
    rerender(<PekuloDatePicker mode="range" value={value} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(false);

    // Flushing the deferred timer is harmless (already closed).
    vi.runAllTimers();
    expect(popoverMock.lastProps?.open).toBe(false);
  });

  test("genuine outside-click / Escape (no onSelect follow-up) — popover CLOSES after tick", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={undefined} onChange={onChange} />,
    );

    // Open the popover.
    popoverMock.lastProps?.onOpenChange?.(true);
    rerender(<PekuloDatePicker mode="range" value={undefined} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(true);

    // Tamagui fires dismiss but onSelect is NEVER called — genuine
    // outside click / Escape / trigger toggle.
    popoverMock.lastProps?.onOpenChange?.(false);
    // Still open synchronously (defer in flight).
    expect(popoverMock.lastProps?.open).toBe(true);

    // Macrotask elapses, timer fires, setOpen(false) runs.
    vi.runAllTimers();
    rerender(<PekuloDatePicker mode="range" value={undefined} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("multiple rapid dismisses are coalesced — only one close fires", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={undefined} onChange={onChange} />,
    );

    popoverMock.lastProps?.onOpenChange?.(true);
    rerender(<PekuloDatePicker mode="range" value={undefined} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(true);

    // Three back-to-back dismisses (e.g. multiple pointerdown events in
    // a fast click sequence). Each schedules a fresh timer; the previous
    // one is cleared. After flushing, the popover closes exactly once.
    popoverMock.lastProps?.onOpenChange?.(false);
    popoverMock.lastProps?.onOpenChange?.(false);
    popoverMock.lastProps?.onOpenChange?.(false);

    vi.runAllTimers();
    rerender(<PekuloDatePicker mode="range" value={undefined} onChange={onChange} />);
    expect(popoverMock.lastProps?.open).toBe(false);
  });

  test("range-mode label format reflects fr-FR with arrow separator", () => {
    const r: DateRange = { from: new Date("2026-01-15"), to: new Date("2026-01-22") };
    const { getByText } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={r} onChange={() => {}} />,
    );
    expect(getByText(/15 janvier 2026.*→.*22 janvier 2026/)).toBeInTheDocument();
  });

  test("range-mode partial label (from only) shows just the from date", () => {
    const r: DateRange = { from: new Date("2026-01-15"), to: undefined };
    const { getByText, queryByText } = renderWithTamagui(
      <PekuloDatePicker mode="range" value={r} onChange={() => {}} />,
    );
    expect(getByText(/15 janvier 2026/)).toBeInTheDocument();
    expect(queryByText(/→/)).toBeNull();
  });
});
