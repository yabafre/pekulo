---
step: 6
reads:
  - ".aped/aped-ux/references/ux-patterns.md"
  - "docs/ux-preview/**"
  - ".aped/scripts/lint-placeholders.sh"
  - "mcp/react-grab.get_element_context"
writes:
  - "docs/ux-preview/**"
  - "subagent/spec-reviewer"
mutates_state: false
---

# Step 6: F4 Pre-Delivery Checklist + F5 User Review + Self-Review + Spec-Reviewer

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the user's `[C]` on the A/C menu — do NOT proceed without it
- 🛑 Spec-reviewer dispatched after self-review passes; HALT on persistent NACK
- 🚫 NEVER write the UX spec before user `[C]`

## YOUR TASK

Run the pre-delivery checklist; iterate user review until `[C]`; run inline self-review; dispatch the spec-reviewer.

## F4 — PRE-DELIVERY CHECKLIST

Read the full Pre-Delivery Checklist from `.aped/aped-ux/references/ux-patterns.md`.

Run through ALL checks BEFORE presenting to the user:

- **Visual Quality** — SVG icons, consistent family, no press jitter, semantic tokens, brand assets.
- **Interaction** — press feedback, touch targets, micro-interaction timing, disabled states, focus order.
- **Light/Dark Mode** — contrast ratios in both, dividers visible, scrim legibility.
- **Layout** — safe areas, fixed bars, tested 3 devices, spacing rhythm, text readability.
- **Accessibility** — labels, hints, errors, color independence, reduced motion, ARIA.

If any check fails: fix before showing to user.

## F5 — USER REVIEW CYCLE (load-bearing)

1. Run `npm run dev` and give the user the local URL.
2. **Use React Grab for visual review** — call `mcp__react-grab-mcp__get_element_context` to inspect specific UI elements the user selects. Gives you the component tree, props, and styles of any element the user points to.
3. Present pre-delivery checklist results.
4. Ask: *"Review each screen. What needs to change?"*
5. Categories of feedback: Layout / Content / Style / Flow / Components / Dark mode.
6. Iterate until user picks `[C]` on the menu below.
7. Each iteration: apply feedback → React Grab to inspect changed elements → run checklist again → present → redisplay menu.

After running the checklist + initial walkthrough, present the A/C menu:

```
UX prototype ready for sign-off. Choose your next move:
[A] Advanced elicitation — invoke aped-elicit on the prototype
    (Feynman test for clarity; Devil's Advocate on flows; Hindsight: "if a real
    user breaks this in 30 days, what did we miss?")
[C] Continue — accept the prototype, write the UX spec, update state.yaml
[Other] Direct feedback — describe layout / content / style / flow / component /
        dark-mode change; I apply it, re-run the checklist, redisplay
```

⏸ **HALT — wait for `[C]`. Do NOT write the UX spec or update state before `[C]`.**

`TaskUpdate: "F — Fill: user review" → completed` once `[C]` is selected.

## INLINE SELF-REVIEW

After `[C]`:

1. **Placeholder lint** — loop over `docs/ux/`:
   ```bash
   for f in docs/ux/*.md; do
     bash .aped/scripts/lint-placeholders.sh "$f" || exit 1
   done
   ```
   Every file must exit 0; abort on first failure and present output.
2. **Screen/flow consistency** — every screen referenced by a flow exists; every flow only references existing screens.
3. **Component inventory complete** — every component used in a screen mock appears in components inventory with props and states.
4. **Accessibility check** — focus order matches visual order; icon buttons have `aria-label`; semantic tokens (not hardcoded) used; touch targets ≥44×44pt.
5. **Viewport assumptions explicit** — spec names breakpoints supported (e.g. 375 / 768 / 1440) and what changes per breakpoint.

If issues, fix inline. No re-review.

## SPEC-REVIEWER DISPATCH

Use the `Agent` tool (`subagent_type: "general-purpose"`) with this verbatim prompt (substitute `[ARTEFACT_FILE_PATH]`):

```
You are a spec document reviewer. Verify this UX spec is complete and ready for planning.

**Spec to review:** [ARTEFACT_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, missing screens referenced by flows, missing component entries |
| Consistency | Screen/flow mismatches, components in mocks but absent from inventory |
| Clarity | Screens whose purpose can't be inferred from the spec alone |
| Accessibility | Focus order gaps, missing aria-labels, hardcoded colors instead of semantic tokens |
| YAGNI | Screens or components no flow or FR requires |

Approve unless serious gaps would lead to a flawed implementation.

## Output Format

## Spec Review

**Status:** Approved | Issues Found

**Issues (if any):**
- [Section X]: [specific issue]

**Recommendations (advisory):** ...
```

When the reviewer returns:
- **Approved** → proceed to step 07.
- **Issues Found** → fix flagged issues inline (or `[O]verride` with reason), then re-dispatch ONCE. If second pass still flags, HALT and present to user.

## SELF-REVIEW CHECKLIST (final gate before output)

Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Placeholder lint** — all `ux/*.md` files exit 0.
- [ ] **Design tokens declared** — colour, typography, spacing scales explicitly listed.
- [ ] **Screen → flow** — every screen has at least one flow that references it.
- [ ] **Component inventory complete** — every component used in a screen mock appears in inventory.
- [ ] **PRD FR coverage** — every PRD FR with a UI surface has at least one mocked screen.
- [ ] **No lorem ipsum** — every mock uses real or realistic content drawn from the PRD.
- [ ] **Spec-reviewer dispatched** — Approved (or `[O]verride` recorded).

## NEXT STEP

Load `.aped/aped-ux/steps/step-07-write-and-completion.md`.
