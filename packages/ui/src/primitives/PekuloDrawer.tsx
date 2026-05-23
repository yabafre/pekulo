"use client";

// PekuloDrawer — Pekulo-themed wrapper around `vaul`'s Drawer primitive.
// Provides a native-feeling bottom-sheet (and side variants) with the
// swipe-to-close gesture vaul ships for free, mirroring shadcn's
// `Drawer` API surface.
//
// Coexists with `PekuloSheet` (Tamagui-based side panel). The choice:
//   - PekuloSheet — Tamagui sheet primitive; opens from a side, no
//                   swipe handle, no mobile-native gesture. Use for
//                   side panels (filters, navigation drawers) where
//                   keyboard-driven UX is the primary concern.
//   - PekuloDrawer — vaul-backed; ships the handle + swipe-to-close
//                    + spring animation. Use for mobile-first bottom
//                    sheets, share dialogs, and any UI that needs the
//                    native sheet feel.

import { Drawer as VaulDrawer } from "vaul";
import type { ComponentProps, ReactNode } from "react";

const DRAWER_CSS = `
.pekulo-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background-color: var(--backgroundOverlay);
}
.pekulo-drawer-content {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background-color: var(--backgroundElevated);
  color: var(--color);
}
.pekulo-drawer-content[data-vaul-drawer-direction="bottom"] {
  inset-inline: 0;
  bottom: 0;
  margin-top: 96px;
  max-height: 80vh;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.pekulo-drawer-content[data-vaul-drawer-direction="top"] {
  inset-inline: 0;
  top: 0;
  margin-bottom: 96px;
  max-height: 80vh;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
.pekulo-drawer-content[data-vaul-drawer-direction="left"] {
  inset-block: 0;
  left: 0;
  width: 75%;
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;
  max-width: 380px;
}
.pekulo-drawer-content[data-vaul-drawer-direction="right"] {
  inset-block: 0;
  right: 0;
  width: 75%;
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
  max-width: 380px;
}
.pekulo-drawer-handle {
  margin: 16px auto 0;
  height: 4px;
  width: 64px;
  flex-shrink: 0;
  border-radius: 9999px;
  background-color: var(--backgroundMuted);
}
.pekulo-drawer-content[data-vaul-drawer-direction="bottom"] > .pekulo-drawer-handle { display: block; }
.pekulo-drawer-content:not([data-vaul-drawer-direction="bottom"]) > .pekulo-drawer-handle { display: none; }
.pekulo-drawer-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  text-align: left;
}
.pekulo-drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  margin-top: auto;
}
.pekulo-drawer-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--color);
  margin: 0;
}
.pekulo-drawer-description {
  font-size: 14px;
  color: var(--colorTertiary);
  margin: 0;
}
`;

function Root(props: ComponentProps<typeof VaulDrawer.Root>) {
  return <VaulDrawer.Root data-slot="drawer" {...props} />;
}

const Trigger = (props: ComponentProps<typeof VaulDrawer.Trigger>) => (
  <VaulDrawer.Trigger data-slot="drawer-trigger" {...props} />
);

const Portal = (props: ComponentProps<typeof VaulDrawer.Portal>) => (
  <VaulDrawer.Portal data-slot="drawer-portal" {...props} />
);

const Close = (props: ComponentProps<typeof VaulDrawer.Close>) => (
  <VaulDrawer.Close data-slot="drawer-close" {...props} />
);

function Overlay(props: ComponentProps<typeof VaulDrawer.Overlay>) {
  return (
    <VaulDrawer.Overlay data-slot="drawer-overlay" className="pekulo-drawer-overlay" {...props} />
  );
}

interface ContentProps extends ComponentProps<typeof VaulDrawer.Content> {
  children?: ReactNode;
}

function Content({ children, ...props }: ContentProps) {
  return (
    <Portal>
      <Overlay />
      <VaulDrawer.Content data-slot="drawer-content" className="pekulo-drawer-content" {...props}>
        <style>{DRAWER_CSS}</style>
        <div className="pekulo-drawer-handle" />
        {children}
      </VaulDrawer.Content>
    </Portal>
  );
}

function Header(props: ComponentProps<"div">) {
  return <div data-slot="drawer-header" className="pekulo-drawer-header" {...props} />;
}

function Footer(props: ComponentProps<"div">) {
  return <div data-slot="drawer-footer" className="pekulo-drawer-footer" {...props} />;
}

function Title(props: ComponentProps<typeof VaulDrawer.Title>) {
  return <VaulDrawer.Title data-slot="drawer-title" className="pekulo-drawer-title" {...props} />;
}

function Description(props: ComponentProps<typeof VaulDrawer.Description>) {
  return (
    <VaulDrawer.Description
      data-slot="drawer-description"
      className="pekulo-drawer-description"
      {...props}
    />
  );
}

export const PekuloDrawer = Object.assign(Root, {
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
});
