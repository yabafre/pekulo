---
step: 5
reads:
  - ".aped/aped-ux/references/ux-patterns.md"
  - "docs/ux-preview/**"
writes:
  - "docs/ux-preview/**"
mutates_state: false
---

# Step 5: F — Fill (States, Responsive, Accessibility)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Every screen has loading / empty / error / success / disabled states
- 🛑 Touch targets ≥ 44×44pt with ≥ 8px spacing
- 🚫 No information conveyed by color alone

## YOUR TASK

Add interaction states, responsive behavior, dark mode (if applicable), and accessibility to every screen.

## F1 — INTERACTION STATES

Read rules P7 (Animation) and P8 (Forms & Feedback) from `.aped/aped-ux/references/ux-patterns.md`.

For each screen, add:

1. **Loading** — skeleton/shimmer for operations >300ms, spinner for buttons.
2. **Empty** — first-use experience with helpful message + CTA, "no results" views.
3. **Error** — inline validation on blur, error below field, error summary at top for long forms.
4. **Success feedback** — toast auto-dismiss 3–5s, confirmation messages.
5. **Disabled** — opacity 0.38–0.5, cursor change, non-interactive.
6. **Press feedback** — visual response within 80–150ms (ripple, opacity, scale 0.95–1.05).
7. **Animations** — 150–300ms micro-interactions, transform/opacity only, ease-out enter, ease-in exit.

## F2 — RESPONSIVE + DARK MODE

Read rules P5 (Layout) and P6 (Typography & Color) from `ux-patterns.md`.

### Responsive — test and fix at 3 breakpoints

- **Mobile (375px)**: single column, hamburger nav, touch targets ≥44px, safe areas.
- **Tablet (768px)**: adapted layout, sidebar may collapse, adjusted gutters.
- **Desktop (1440px)**: full layout, max-width container, sidebar visible.

### Dark mode (if applicable)

- Semantic color tokens mapped per theme (NOT hardcoded hex).
- Desaturated/lighter variants, NOT inverted colors.
- Primary text ≥ 4.5:1, secondary ≥ 3:1 in both modes.
- Borders/dividers distinguishable in both modes.
- Modal scrim: 40–60% black, foreground legible.
- Test both themes independently.

## F3 — ACCESSIBILITY PASS

Read rules P1 (Accessibility) and P2 (Touch) from `ux-patterns.md`.

- Contrast: 4.5:1 normal text, 3:1 large text (test with browser devtools).
- Focus rings: 2–4px, visible on all interactive elements.
- Tab order: matches visual order.
- Form labels: visible, associated, NOT placeholder-only.
- Icon buttons: `aria-label`.
- Skip-to-main link.
- Heading hierarchy: h1 → h2 → h3, no skipping.
- Touch targets: ≥44×44pt with ≥8px spacing.
- No information conveyed by color alone.

## SUCCESS METRICS

✅ Every screen has all 5 states (loading / empty / error / success / disabled).
✅ Tested at 3 breakpoints.
✅ Dark mode (if applicable) uses semantic tokens; contrast verified.
✅ Accessibility pass: focus order matches visual order; icon buttons have `aria-label`.

## FAILURE MODES

❌ Skipping empty states — *"first run"* UX dies on day 1.
❌ Inverted dark mode colors — looks broken in real apps.
❌ Color-only error indication — fails WCAG.

## NEXT STEP

Load `.aped/aped-ux/steps/step-06-pre-delivery-and-review.md`.
