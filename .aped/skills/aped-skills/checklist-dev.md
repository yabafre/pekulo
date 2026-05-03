# aped-dev — Completion Gate

Read this checklist BEFORE declaring dev complete. Every unchecked item is a blocker.

- [ ] **Branch verified** as a feature branch (not main/master/prod/develop) — branch creation is aped-story's job, this skill only verifies
- [ ] **RED witnessed** for every new test (Confirmed RED token emitted)
- [ ] **GREEN confirmed** (test runner exit 0, output visible in transcript)
- [ ] **Verbatim AC quote** present above each test (no paraphrase)
- [ ] **Schema identifiers** verified verbatim against story / PRD (no invented table/column names)
- [ ] **One commit per task** (not batched at the end)
- [ ] **No git add .** anywhere — specific files only
- [ ] **No --no-verify** on any commit (pre-commit hooks must run)
- [ ] **last-test-exit cache** updated (.aped/.last-test-exit = 0)
- [ ] **Story file Dev Agent Record** filled (NO Review Record — that's aped-review's territory)
- [ ] **Story file status** updated to review (not still ready-for-dev)
- [ ] **state.yaml updated** (pipeline.phases.dev.status = complete)
- [ ] **Ticket synced** (if ticket_system != none: status → In Review, comment with summary)
- [ ] **PR created** with link to story (only in classic solo mode without sprint umbrella)
- [ ] **dev-done check-in posted** (worktree/parallel-sprint mode only)
