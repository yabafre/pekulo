# aped-story — Completion Gate

- [ ] **Branch refusal-on-main respected** — never created a story on main/master/prod/production/develop/release/*/DETACHED
- [ ] **Feature branch created** before writing the story file (solo mode) OR pre-existing in worktree mode
- [ ] **Branch name follows convention** feature/{ticket}-{slug} (or feature/none-{slug} when ticket_system=none)
- [ ] **Step-0 quote** present in Dev Notes for every modified file (or "none — new file" for greenfield)
- [ ] **File structure design** present — 3-bullet decision template per file in File List
- [ ] **Reader-persona check** ran — story top-to-bottom asks "would the junior produce the right code from this?"
- [ ] **Task granularity contract** — every task has all 5 must-haves (path, full code, test cmd, expected output, commit step)
- [ ] **Forbidden patterns absent** — no "similar to story X", "appropriate error handling", "see line N", snippet "..."
- [ ] **Story file written** to {{OUTPUT_DIR}}/stories/
- [ ] **Placeholder lint** passed (no TODO/TBD/<replace-me> in the story file)
- [ ] **state.yaml updated** (sprint.stories.{key}.status = ready-for-dev)
- [ ] **Ticket synced** (if ticket_system != none: assign + post refined-AC comment, never overwrite body)
- [ ] **All ACs** have measurable acceptance criteria (no "should work well")
- [ ] **ACs describe behaviour** not implementation (no file paths or function names in ACs — those go in Tasks)
- [ ] **Worktree mode**: story file + state.yaml committed on the feature branch, story-ready check-in posted
