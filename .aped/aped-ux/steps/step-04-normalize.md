---
step: 4
reads:
  - "docs/prd.md"
  - ".aped/aped-ux/references/ux-patterns.md"
  - "docs/ux-preview/**"
writes:
  - "docs/ux-preview/**"
mutates_state: false
---

# Step 4: N — Normalize (Layout + Screens with Real Content)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 No lorem ipsum — every text element reflects the actual product
- 🛑 Read PRD FRs for each screen before building it

## YOUR TASK

Build the layout shell + navigation, then implement each screen with real PRD-derived content.

## N1 — LAYOUT + NAVIGATION

Read PRD user journeys and the screen inventory rule set from `.aped/aped-ux/references/ux-patterns.md`.

1. **Map screens** from PRD user journeys:
   - Each journey → concrete screens.
   - Name: `{area}-{action}` slug (e.g., `auth-login`, `dashboard-overview`).
   - Classify: form, list, detail, dashboard, wizard, modal.

2. **Build layout shell** — `src/layouts/`:
   - App layout (header, sidebar/nav, content, footer).
   - Auth layout (centered card).
   - Apply design tokens throughout.

3. **Set up routing** — React Router with all screens as routes:
   - `src/App.tsx` — router config.
   - `src/pages/{ScreenSlug}.tsx` — one page per screen (initially placeholder).

4. **Navigation** — read rule P9 (Navigation) from `ux-patterns.md`:
   - Sidebar or top nav matching design inspiration.
   - Active state indicators on current route.
   - Mobile: bottom nav ≤5 items (icon + label) or hamburger/drawer.
   - Desktop ≥1024px: sidebar; smaller: bottom/top nav.
   - Predictable back behavior, preserve scroll/state.
   - Same navigation placement across all pages.

Run: `npm run dev` — verify app runs with working navigation.

## N2 — SCREEN IMPLEMENTATION

For each screen, in priority order (core journey first):

1. **Read relevant FRs** for this screen.
2. **Build with UI library components** (or custom styled).
3. **Use real mock data** from `src/data/mock.ts` — product names, user names, realistic dates and numbers.
4. **Implement the primary content** — forms, tables, cards, etc.
5. **Wire interactions** — form submits, button clicks, navigation (no-op handlers OK at this stage).

**No lorem ipsum.** Every text element must reflect the actual product:

- SaaS dashboard → realistic metric names and values.
- E-commerce → real-looking product names and prices.
- Project tool → plausible project names and statuses.

`TaskUpdate: "N — Normalize: implement screens" → completed`

## SUCCESS METRICS

✅ All screens routed; layout shell uses tokens.
✅ Each screen content drawn from PRD (no lorem ipsum).
✅ Navigation tested at 3 breakpoints (mobile, tablet, desktop).

## FAILURE MODES

❌ A screen with placeholder text — junior reading the prototype builds the wrong thing.
❌ Hardcoded colors in components — breaks theming in step 05.

## NEXT STEP

Load `.aped/aped-ux/steps/step-05-fill.md`.
