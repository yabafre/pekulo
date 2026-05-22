"use client";

// PekuloResizable family — shadcn-`Resizable` parity. Wraps
// react-resizable-panels (v4) with Pekulo-styled handles. Used for
// split-view layouts (bento dashboards, settings master-detail,
// dev tools side-by-side).
//
// react-resizable-panels v4 export names: `Group` (group root),
// `Panel`, `Separator` (the handle). shadcn's snippet targets v3
// (`PanelGroup` / `PanelResizeHandle`); we adapt to v4 without
// changing the consumer API.

import {
  Panel as ResizablePanelPrimitive,
  Group as ResizablePanelGroupPrimitive,
  Separator as ResizableHandlePrimitive,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";
import type { CSSProperties } from "react";

const RESIZABLE_CSS = `
.pekulo-resizable-handle {
  position: relative;
  display: flex;
  width: 1px;
  align-items: center;
  justify-content: center;
  background-color: var(--borderDefault);
  flex-shrink: 0;
}
.pekulo-resizable-handle::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
}
.pekulo-resizable-handle[data-panel-group-direction="vertical"] {
  width: 100%;
  height: 1px;
}
.pekulo-resizable-handle[data-panel-group-direction="vertical"]::after {
  left: 0;
  height: 4px;
  width: 100%;
  transform: translateY(-50%);
  inset-block: auto;
  top: 50%;
}
.pekulo-resizable-handle:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
.pekulo-resizable-handle-grip {
  z-index: 10;
  display: flex;
  height: 24px;
  width: 4px;
  flex-shrink: 0;
  border-radius: 8px;
  background-color: var(--borderDefault);
}
.pekulo-resizable-handle[data-panel-group-direction="vertical"] .pekulo-resizable-handle-grip {
  transform: rotate(90deg);
}
`;

// ─── PanelGroup ──────────────────────────────────────────────────────────

const groupStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  height: "100%",
};

export function PekuloResizablePanelGroup({ style, orientation, ...props }: GroupProps) {
  return (
    <>
      <style>{RESIZABLE_CSS}</style>
      <ResizablePanelGroupPrimitive
        data-slot="resizable-panel-group"
        orientation={orientation}
        style={{
          ...groupStyle,
          flexDirection: orientation === "vertical" ? "column" : "row",
          ...style,
        }}
        {...props}
      />
    </>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────

export function PekuloResizablePanel(props: PanelProps) {
  return <ResizablePanelPrimitive data-slot="resizable-panel" {...props} />;
}

// ─── Handle ──────────────────────────────────────────────────────────────

export interface PekuloResizableHandleProps extends SeparatorProps {
  /** When true, renders a centered grip affordance on the handle. */
  withHandle?: boolean;
  className?: string;
}

export function PekuloResizableHandle({
  withHandle = false,
  className,
  ...props
}: PekuloResizableHandleProps) {
  return (
    <ResizableHandlePrimitive
      data-slot="resizable-handle"
      className={["pekulo-resizable-handle", className].filter(Boolean).join(" ")}
      {...props}
    >
      {withHandle && <div className="pekulo-resizable-handle-grip" />}
    </ResizableHandlePrimitive>
  );
}
