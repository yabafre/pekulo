---
name: aped-ux
description: 'Designs UX via the ANF framework (Assemble design system, Normalize with React preview, Fill all screens). Use when user says "design UX", "UX spec", "aped ux", or invokes /aped-ux. Runs between PRD and Epics phases.'
license: MIT
compatibility: 'Requires Node.js 18+ and npm for Vite+React preview scaffold'
metadata:
  author: yabafre
  version: 3.7.6
---

# APED UX — ANF Framework

## Critical Rules

- NEVER use lorem ipsum — every text element must reflect the actual product from the PRD
- ALWAYS run the pre-delivery checklist before presenting to user
- Take your time with each screen — quality is more important than speed
- Do not skip the user review cycle — the prototype MUST be approved before proceeding

Produces a validated, interactive React prototype from the PRD. The prototype becomes the UX spec that `/aped-epics` consumes as the visual source of truth.

**ANF = Assemble → Normalize → Fill**

```
A: Design DNA        N: React Preview        F: Complete + Validate
   (inputs)             (live prototype)         (user-approved spec)

Inspirations         Vite + React app        All screens built
+ UI library         with REAL content       + interaction states
+ color/typo         from PRD context        + responsive behavior
+ components         (no lorem ipsum)        + user review cycles
                                             = UX spec for /aped-epics
```

## Setup

1. Read `.aped/config.yaml` — extract config
2. Read `docs/state.yaml` — check pipeline state
   - If `pipeline.phases.ux.status` is `done`: ask user — redo or skip?
   - If user skips: stop here (user will invoke next phase manually)
3. Read `.aped/aped-ux/references/ux-patterns.md` for design patterns catalog

## Task Tracking

```
TaskCreate: "A — Assemble: collect design DNA"
TaskCreate: "A — Assemble: scaffold Vite + React preview app"
TaskCreate: "N — Normalize: build layout + navigation + design tokens"
TaskCreate: "N — Normalize: implement screens with real PRD content"
TaskCreate: "F — Fill: complete all states (loading, error, empty)"
TaskCreate: "F — Fill: responsive + accessibility pass"
TaskCreate: "F — Fill: user review + validation"
```

---

## A — ASSEMBLE (Design DNA)

### A1: Collect Design Inputs

Ask the user (adapt to `communication_language`):

1. **Inspirations** — "Share screenshots, URLs, or describe the visual direction you want"
   - Accept: image files (Read tool), URLs (WebFetch), or verbal description
   - If images: analyze layout, density, color palette, typography, component style
   - If URLs: fetch and analyze visual patterns

2. **UI Library** — "Which component library? Or none (custom)?"
   - Options: shadcn/ui, Radix UI, MUI, Ant Design, Chakra UI, Mantine, none
   - If specified: use MCP context7 (`resolve-library-id` then `query-docs`) to load component API
   - If none: will create custom components styled to match inspirations

3. **Design Tokens** — Extract or ask:
   - **Colors**: primary, secondary, accent, neutral scale, semantic (success/warning/error/info)
   - **Typography**: font family, size scale (xs to 2xl), weight scale, line heights
   - **Spacing**: base unit (4px/8px), scale (1-12)
   - **Radius**: none/sm/md/lg/full
   - **Shadows**: sm/md/lg/xl

4. **Branding** — Logo, brand colors, tone (playful/serious/minimal/bold)

### A2: Scaffold Preview App

```bash
mkdir -p docs/ux-preview
cd docs/ux-preview
npm create vite@latest . -- --template react-ts
npm install
```

If UI library chosen:
```bash
# Example for shadcn/ui:
npx shadcn@latest init
# Example for MUI:
npm install @mui/material @emotion/react @emotion/styled
```

Create design token files:
- `src/tokens/colors.ts` — color palette as CSS custom properties or theme object
- `src/tokens/typography.ts` — font config
- `src/tokens/spacing.ts` — spacing scale
- `src/theme.ts` — unified theme export

Create `src/data/mock.ts` — **real content from PRD**, not lorem ipsum:
- Extract product name, user types, feature names, sample data from PRD
- Generate realistic mock data that matches the product domain
- Example: if building a project manager, mock projects have real-sounding names and dates

`TaskUpdate: "A — Assemble: scaffold" → completed`

---

## N — NORMALIZE (React Preview with Real Content)

### N1: Layout + Navigation

Read PRD user journeys and screen inventory (from `.aped/aped-ux/references/ux-patterns.md`).

1. **Map screens** from PRD user journeys:
   - Each journey → concrete screens
   - Name: `{area}-{action}` slug (e.g., `auth-login`, `dashboard-overview`)
   - Classify: form, list, detail, dashboard, wizard, modal

2. **Build layout shell** — `src/layouts/`:
   - App layout (header, sidebar/nav, content, footer)
   - Auth layout (centered card)
   - Apply design tokens throughout

3. **Set up routing** — React Router with all screens as routes:
   - `src/App.tsx` — router config
   - `src/pages/{ScreenSlug}.tsx` — one page per screen (initially placeholder)

4. **Navigation** — read rules P9 (Navigation) from `.aped/aped-ux/references/ux-patterns.md`:
   - Sidebar or top nav matching design inspiration
   - Active state indicators on current route
   - Mobile: bottom nav ≤5 items (icon + label) or hamburger/drawer
   - Desktop ≥1024px: sidebar; smaller: bottom/top nav
   - Predictable back behavior, preserve scroll/state
   - Same navigation placement across all pages

Run: `npm run dev` — verify app runs with working navigation.

### N2: Screen Implementation

For each screen, in priority order (core journey first):

1. **Read relevant FRs** for this screen
2. **Build with UI library components** (or custom styled components)
3. **Use real mock data** from `src/data/mock.ts` — product names, user names, realistic dates and numbers
4. **Implement the primary content** — forms, tables, cards, etc.
5. **Wire interactions** — form submits, button clicks, navigation (can be no-op handlers)

**CRITICAL: No lorem ipsum.** Every text element must reflect the actual product:
- If it's a SaaS dashboard, show realistic metric names and values
- If it's an e-commerce, show real-looking product names and prices
- If it's a project tool, show plausible project names and statuses

`TaskUpdate: "N — Normalize: implement screens" → completed`

---

## F — FILL (Complete + Validate)

### F1: Interaction States

Read rules P7 (Animation) and P8 (Forms & Feedback) from `.aped/aped-ux/references/ux-patterns.md`.

For each screen, add:

1. **Loading states** — skeleton/shimmer for operations >300ms, spinner for buttons
2. **Empty states** — first-use experience with helpful message + CTA, "no results" views
3. **Error states** — inline validation on blur, error below field, error summary at top for long forms
4. **Success feedback** — toast auto-dismiss 3-5s, confirmation messages
5. **Disabled states** — opacity 0.38-0.5, cursor change, non-interactive
6. **Press feedback** — visual response within 80-150ms (ripple, opacity, scale 0.95-1.05)
7. **Animations** — 150-300ms micro-interactions, transform/opacity only, ease-out enter, ease-in exit

### F2: Responsive + Dark Mode

Read rules P5 (Layout) and P6 (Typography & Color) from `.aped/aped-ux/references/ux-patterns.md`.

1. **Responsive** — test and fix at 3 breakpoints:
   - Mobile (375px): single column, hamburger nav, touch targets ≥44px, safe areas
   - Tablet (768px): adapted layout, sidebar may collapse, adjusted gutters
   - Desktop (1440px): full layout, max-width container, sidebar visible

2. **Dark mode** — if applicable:
   - Semantic color tokens mapped per theme (not hardcoded hex)
   - Desaturated/lighter variants, NOT inverted colors
   - Primary text ≥ 4.5:1, secondary ≥ 3:1 in both modes
   - Borders/dividers distinguishable in both modes
   - Modal scrim: 40-60% black, foreground legible
   - Test both themes independently

### F3: Accessibility Pass

Read rules P1 (Accessibility) and P2 (Touch) from `.aped/aped-ux/references/ux-patterns.md`.

- Contrast: 4.5:1 normal text, 3:1 large text (test with browser devtools)
- Focus rings: 2-4px, visible on all interactive elements
- Tab order: matches visual order
- Form labels: visible, associated, not placeholder-only
- Icon buttons: aria-label
- Skip-to-main link
- Heading hierarchy: h1→h2→h3, no skipping
- Touch targets: ≥44x44pt with ≥8px spacing
- No information conveyed by color alone

### F4: Pre-Delivery Checklist

Read the full Pre-Delivery Checklist from `.aped/aped-ux/references/ux-patterns.md`.

Run through ALL checks before presenting to user:

**Visual Quality** — SVG icons, consistent family, no press jitter, semantic tokens, brand assets
**Interaction** — press feedback, touch targets, micro-interaction timing, disabled states, focus order
**Light/Dark Mode** — contrast ratios in both, dividers visible, scrim legibility
**Layout** — safe areas, fixed bars, tested 3 devices, spacing rhythm, text readability
**Accessibility** — labels, hints, errors, color independence, reduced motion, ARIA

If any check fails: fix before showing to user.

### F5: User Review Cycle

**This is the most important step.** The prototype must be validated by the user.

1. Run `npm run dev` and give the user the local URL
2. **Use React Grab for visual review** — call `mcp__react-grab-mcp__get_element_context` to inspect specific UI elements the user selects. This gives you the component tree, props, and styles of any element the user points to, making review precise instead of guessing from screenshots.
3. Present the pre-delivery checklist results
4. Ask: "Review each screen. What needs to change?"
5. Categories of feedback:
   - **Layout** — move, resize, reorder sections
   - **Content** — missing info, wrong hierarchy, unclear labels
   - **Style** — colors, spacing, typography adjustments
   - **Flow** — navigation changes, missing screens, wrong order
   - **Components** — wrong component type, missing states, wrong behavior
   - **Dark mode** — contrast issues, token problems, scrim opacity

6. **Iterate** until user says "approved" or "good enough"
7. Each iteration: apply feedback → use React Grab to inspect the changed elements → run checklist again → present → ask again

`TaskUpdate: "F — Fill: user review" → completed`

---

## Output

Once user approves the prototype:

```bash
mkdir -p docs/ux
```

1. **Preview app stays** at `docs/ux-preview/` — living reference
2. Write `docs/ux/design-spec.md`:
   - Design tokens (colors, typo, spacing, radius)
   - UI library + version
   - Screen inventory with routes
   - Component tree with props
   - Layout specifications
   - Responsive breakpoints
3. Write `docs/ux/screen-inventory.md` — all screens with FR mapping
4. Write `docs/ux/components.md` — component catalog from the preview app
5. Write `docs/ux/flows.md` — navigation flow diagrams

The preview app (`docs/ux-preview/`) IS the source of truth for downstream skills. Use React Grab to inspect it rather than static screenshots.

## Validation

```bash
bash .aped/aped-ux/scripts/validate-ux.sh docs/ux
```

If validation fails: fix missing files or content and re-validate.

## State Update

Update `docs/state.yaml`:
```yaml
pipeline:
  current_phase: "ux"
  phases:
    ux:
      status: "done"
      output: "docs/ux/"
      preview: "docs/ux-preview/"
      design_system:
        ui_library: "{library}"
        tokens: "docs/ux-preview/src/tokens/"
```

## Next Step

Tell the user: "UX design is ready. Run `/aped-epics` to create epics and stories."

The epics phase reads `docs/ux/` (all 4 spec files) and inspects the live preview app via React Grab to enrich stories with:
- Component references (which component to use, which props)
- Screen references from the live preview app
- Design tokens to respect
- Responsive requirements per screen

**Do NOT auto-chain.** The user decides when to proceed.

## Common Issues

- **npm create vite fails**: Ensure Node.js 18+ is installed. Try `node --version` first.
- **UI library install fails**: Check network. For shadcn, ensure the project has a tsconfig.json.
- **User gives no design inspiration**: Use the product domain to suggest a style — "SaaS dashboard" → clean/minimal, "e-commerce" → card-heavy/visual
- **Prototype looks wrong on mobile**: Check responsive breakpoints — sidebar must collapse, touch targets ≥ 44px
- **Dark mode contrast fails**: Use semantic tokens, not hardcoded colors. Check with browser devtools contrast checker.
