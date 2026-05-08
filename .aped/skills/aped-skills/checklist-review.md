# aped-review — Completion Gate

- [ ] **Fresh context** (not same session as implementation — if same, /clear first)
- [ ] **3 auditors dispatched in parallel** — Spec, Code (file-surface aware), Edge & hallucination
- [ ] **Aria dispatched** when frontend + preview app present (visual review via React Grab MCP)
- [ ] **5 testing anti-patterns** included in Code auditor's prompt and findings reflect it
- [ ] **git-audit.sh ran inline** by the Lead (not paraphrased)
- [ ] **Spec NACK handled** — [F]ix or [O]verride with non-empty reason (override path only)
- [ ] **Every finding has evidence** — file:line + Evidence + Suggested fix + Source
- [ ] **Verification re-run captured in this message** (test runner output / diff+output / screenshot)
- [ ] **No forbidden phrases alone** — "should work" / "looks good" / "probably fine" never present without evidence
- [ ] **Verdict** clearly stated (story → done OR stays review)
- [ ] **Ticket comment posted** with the consolidated report (if ticket_system != none)
- [ ] **PR opened/updated against sprint.umbrella_branch** (NEVER against base) — only when story → done
- [ ] **Review Record appended to the story file** at {{OUTPUT_DIR}}/stories/{story-key}.md
- [ ] **NO separate review file created** anywhere — the story file is the single canonical home
- [ ] **state.yaml updated** to match the verdict (story → done OR stays review)
- [ ] **epic-{N}-context.md updated** with the strict Decisions/Files/Contracts/Deviations entry (only if story → done)
- [ ] **review-done check-in posted** (worktree/parallel-sprint mode + story → done)
