---
step: 3
reads:
  - "docs/prd.md"
  - ".aped/scripts/detect-package-runner.sh"
  - "mcp/context7.resolve-library-id"
  - "mcp/context7.query-docs"
writes:
  - "docs/ux-preview/**"
mutates_state: false
---

# Step 3: A — Assemble (Design DNA + Preview Scaffold)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 No assumed runner — use `aped/scripts/detect-package-runner.sh` if available, else ask user
- 🛑 Mock data uses REAL product names from PRD (no lorem ipsum)

## YOUR TASK

Collect design DNA from the user; scaffold a Vite + React preview app with design tokens and real mock data.

## A1 — DESIGN INPUTS

Ask the user (in `communication_language`):

1. **Inspirations** — *"Share screenshots, URLs, or describe the visual direction you want"*
   - Images → Read tool to analyze layout, density, palette, typography, component style.
   - URLs → WebFetch to analyze visual patterns.
   - Verbal → capture as text.

2. **UI Library** — *"Which component library? Or none (custom)?"*
   - Options: shadcn/ui, Radix UI, MUI, Ant Design, Chakra UI, Mantine, none.
   - If specified: use MCP context7 (`resolve-library-id` then `query-docs`) to load component API.
   - If none: create custom components styled to match inspirations.

3. **Design tokens** — extract or ask:
   - **Colors** — primary, secondary, accent, neutral scale, semantic (success/warning/error/info).
   - **Typography** — font family, size scale (xs to 2xl), weight scale, line heights.
   - **Spacing** — base unit (4px/8px), scale (1–12).
   - **Radius** — none/sm/md/lg/full.
   - **Shadows** — sm/md/lg/xl.

4. **Branding** — logo, brand colors, tone (playful/serious/minimal/bold).

## A2 — SCAFFOLD PREVIEW APP

```bash
mkdir -p docs/ux-preview
cd docs/ux-preview
npm create vite@latest . -- --template react-ts
npm install
```

If UI library chosen:

```bash
# shadcn/ui
npx shadcn@latest init
# MUI
npm install @mui/material @emotion/react @emotion/styled
```

Create design token files:

- `src/tokens/colors.ts` — color palette as CSS custom properties or theme object.
- `src/tokens/typography.ts` — font config.
- `src/tokens/spacing.ts` — spacing scale.
- `src/theme.ts` — unified theme export.

Create `src/data/mock.ts` — **real content from PRD**, not lorem ipsum:

- Extract product name, user types, feature names, sample data from PRD.
- Generate realistic mock data that matches the product domain.
- Example: if building a project manager, mock projects have real-sounding names and dates.

`TaskUpdate: "A — Assemble: scaffold" → completed`

## SUCCESS METRICS

✅ Design DNA captured (inspirations, library, tokens, branding).
✅ Preview app scaffolded; tokens declared.
✅ `src/data/mock.ts` uses real product names from PRD.

## FAILURE MODES

❌ Lorem ipsum in `mock.ts` — fails the no-lorem rule.
❌ Hardcoded hex in tokens instead of semantic — breaks dark mode in step 05.

## NEXT STEP

Load `.aped/aped-ux/steps/step-04-normalize.md`.
