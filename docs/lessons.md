# Lessons Learned

Patterns from user corrections — so the same mistake isn't made twice.

## Format

- **Date:** YYYY-MM-DD
- **Mistake:** What I did wrong
- **Correction:** What the user told me
- **Rule:** The pattern to apply going forward

## Entries

<!-- Add new entries at the top -->

### 2026-05-04 — `oxlint`/`oxfmt` have no `--staged` CLI flag (Scope: aped-arch, aped-story, aped-dev — story 0-11)

- **Date:** 2026-05-04
- **Mistake:** Story 0-2 (and the architecture reference at `docs/architecture.md` lines ~617–622) declared that lefthook's pre-commit hook for story 0-11 would invoke `oxlint --fix --staged` and `oxfmt --staged`. Verified during aped-review Kai pass: neither `oxlint@1.62.0` nor `oxfmt@0.47.0` exposes a `--staged` flag. Both accept positional `PATH` arguments only.
- **Correction:** Story 0-11 must use lefthook's variable expansion (`{staged_files}`) and pass file paths as positional arguments — `oxlint --fix {staged_files}` and `oxfmt {staged_files}` — NOT literal `--staged`. Story 0-2's architecture-reference line was patched in the same review pass (commit citing this lesson).
- **Rule:** When forward-pointing CLI flag invocations across stories, verify the flag exists in the pinned binary (`bun x <tool> --help`) before quoting it in a downstream story spec or ADR. Pre-1.0 toolchains in particular drift between schema docs and binary support. Apply this discipline whenever adopting a new CLI tool with planned downstream integrations.

### 2026-05-04 — oxlint rejects `_reason` annotation on rules without options-schema (Scope: aped-dev, aped-story — story 0-2 + 0-12)

- **Date:** 2026-05-04
- **Mistake:** Story 0-2 Task 4 option 2 (line ~497–503) claimed oxlint's schema is permissive on unknown sub-keys, instructing the dev to disable rules via `["off", { "_reason": "<why>" }]` array form for human auditing. Verified during aped-review fix-cycle: oxlint validates rule-option payloads against each rule's own option-schema. Rules without options (e.g. `react/react-in-jsx-scope`, `import/no-unassigned-import`) reject the `{ _reason: ... }` payload with `Rule does not accept configuration options`.
- **Correction:** For rules WITHOUT options-schema, use simple-string severity (`"off"` / `"error"` / `"warn"`) — rationale lives in the commit message and Review Record, not in the JSON. The array-with-\_reason form works ONLY on rules that already accept options (e.g. `react/self-closing-comp` accepts `{ "html": false }`).
- **Rule:** Story 0-12 (`@pekulo/oxlint-config`) should provide a centralized rule-rationale mechanism (e.g. comments in a `.cjs` config, or a sidecar `oxlint-rationale.md` keyed by rule name) instead of inlining `_reason` keys. Update story 0-2 Task 4 option 2 wording in any future story-template tweak. Apply this pattern check whenever a config schema is described as "permissive on unknown keys" — verify by attempting a no-op key on a strictly-typed sub-schema first.

### 2026-05-04 — oxlint `settings.react.version` requires SemVer string, no `"detect"` (Scope: aped-dev — story 0-12)

- **Date:** 2026-05-04
- **Mistake:** Reviewer assumed `settings.react.version` accepts `"detect"` (mirroring eslint-plugin-react). Verified: oxlint's schema constrains the value with regex `^[1-9]\d*(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?$` (SemVer-only). Setting `"detect"` fails at config-parse time.
- **Correction:** Hard-code the React version in `.oxlintrc.json` and update it in lockstep with `apps/web/package.json` on every React bump. Centralize via `@pekulo/oxlint-config` in story 0-12.
- **Rule:** Don't assume eslint plugin behaviour carries over to oxlint's native Rust port — the schema is stricter. Verify via `node_modules/oxlint/configuration_schema.json` (or the pinned binary's `--help`) before assuming feature parity.
