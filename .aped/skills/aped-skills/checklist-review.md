# aped-review — Completion Gate

- [ ] **Fresh context** (not same session as implementation — if same, /clear first)
- [ ] **Stage 1 (Eva)** completed — AC validation verdict rendered as a synchronous gate
- [ ] **NACK handled** — Eva NACK led to [F]ix or [O]verride with non-empty reason (override path only)
- [ ] **Stage 1.5** dispatched in parallel (if review.parallel_reviewers = true in config) — Hannah/Eli/Aaron
- [ ] **Stage 2** dispatched in a single Agent message — Marcus/Rex + conditionals
- [ ] **Marcus 5-anti-pattern audit** included in his prompt and findings reflect it
- [ ] **Rex git-audit** ran via the script (not paraphrased)
- [ ] **Minimum 3 findings** — re-dispatch a specialist if fewer
- [ ] **Every finding has evidence** — file:line + Evidence + Suggested fix + Source
- [ ] **Verification re-run captured in this message** (test runner output / diff+output / screenshot)
- [ ] **No forbidden phrases alone** — "should work" / "looks good" / "probably fine" never present without evidence
- [ ] **Verdict** clearly stated (story → done OR stays review)
- [ ] **Ticket comment posted** with the consolidated report (if ticket_system != none)
- [ ] **PR opened/updated against sprint.umbrella_branch** (NEVER against base) — only when story → done
- [ ] **Review Record appended to the story file** at {{OUTPUT_DIR}}/stories/{story-key}.md
- [ ] **NO separate review file created** anywhere — the story file is the single canonical home
- [ ] **state.yaml updated** to match the verdict (story → done OR stays review)
- [ ] **review-done check-in posted** (worktree/parallel-sprint mode + story → done)
