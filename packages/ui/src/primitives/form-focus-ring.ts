// packages/ui/src/primitives/form-focus-ring.ts
// Shared keyboard focus indicator for the native form controls
// (PekuloInput / PekuloTextarea / PekuloNativeSelect) — NFR-24.
//
// Why this file exists: the three controls each carried `outline: "none"`
// in their INLINE style, which suppressed the UA ring and left nothing in
// its place. They stayed keyboard-reachable but gave no visible indicator.
// axe never caught it (WCAG 2.4.7 is not machine-checkable), and apps/web
// had already started patching around it locally — see
// `apps/web/src/app/(cap)/_components/form-controls.module.css`, added for
// exactly this reason on the radio inputs.
//
// Why the reset moved out of the inline style: an inline `outline: none`
// outranks any external `:focus-visible` rule, so the ring could not be
// restored from CSS while the inline declaration remained. The reset now
// lives on the base class and `:focus-visible` overrides it by
// specificity.
//
// Ring geometry matches PekuloButton's (`2px solid var(--color)`,
// `outline-offset: 2px`) so every focusable DS surface reads the same.
// Injected as a plain <style> next to the control, mirroring
// PekuloButton / PekuloSubmitButton — keeps the primitives RSC-safe
// without a CSS-module dependency.

export const PEKULO_FIELD_CLASS = "pekulo-field";

export const PEKULO_FIELD_CSS = `
.${PEKULO_FIELD_CLASS} { outline: none; }
.${PEKULO_FIELD_CLASS}:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
`;
