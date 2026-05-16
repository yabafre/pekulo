# Markdown Schema DSL

Structural contract for APED markdown artefacts. One JSON manifest per artefact;
one validator script per manifest; one shared Node walker behind them.

Designed for "walk markdown headings + check section content" — narrow on purpose.
Extensions land in a future MINOR after a design pass. Field set locked in 6.3.0;
6.9.0 added recursive `sub_sections` for level-3+ contracts (cohort-2);
6.10.0 ships cohort-3 `prd.schema.json` on the existing field set (no new fields);
6.11.0 ships cohort-3b `architecture.schema.json` + two new optional DSL fields:
`top_level_patterns` (schema-level regex allowlist for L2 names alongside the
fixed `top_level`) and `sub_sections_heading_pattern` (section-level regex
allowlist for direct children, coexists with `sub_sections[]`).

JSON parity with `state.yaml.schema.v3.json` (chantier S, 6.2.0). Walker is
`scripts/lib/markdown-schema-walk.mjs` (Node companion — Node is already required
to run aped-method itself; zero npm runtime deps).

## Manifest shape

```json
{
  "artefact_name": "story",
  "description": "Single-story spec consumed by aped-dev / aped-review.",
  "version": 1,

  "top_level": [
    "User Story",
    "Acceptance Criteria",
    "Tasks",
    "Dev Notes",
    "File List",
    "Dev Agent Record"
  ],

  "sections": [
    {
      "heading": "User Story",
      "level": 2,
      "required": true,
      "forbid_invented_sub_headings": true
    },
    {
      "heading": "Acceptance Criteria",
      "level": 2,
      "required": true,
      "lines_match": "^[\\s]*-.*([Gg]iven|[Ww]hen|[Tt]hen)"
    },
    {
      "heading": "Dev Agent Record",
      "level": 2,
      "required": false
    }
  ]
}
```

## Field reference

| Field | Type | Default | Purpose |
|---|---|---|---|
| `artefact_name` | string | — | Canonical name. Validator script is `validate-<artefact_name>.sh`. Mandatory. |
| `description` | string | — | One-line human description. Mandatory. |
| `version` | int | — | Schema version. Bump on any incompatible change. Mandatory. |
| `top_level` | string[] | — | Ordered allowlist of `## ` headings. Any `## X` in the target outside this list (and not matched by `top_level_patterns`) is "invented" → fail. Mandatory. |
| `top_level_patterns` | string[] | `[]` | (6.11.0) Regex allowlist for L2 names alongside `top_level`. Source strings compiled via `new RegExp(...)`. A `## X` heading is accepted if it appears in `top_level` OR matches any pattern. Pattern-matched headings are accepted in any position, any count — they do NOT advance the fixed-order cursor. Use for variable-count entries like `## ADR-N: <title>`. Invalid regex → exit 2. |
| `sections` | object[] | — | Content rules, one entry per heading. Section objects below. Mandatory (may be empty if no per-section rules). |

### Section object fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `heading` | string | — | Exact heading text (no `#` prefix). Mandatory. |
| `level` | int 1–6 | — | Markdown heading level (`##` = 2, `###` = 3). Mandatory. |
| `required` | bool | `true` | If `true`, missing heading → fail. If `false`, absence is OK. |
| `order` | `"fixed"`\|`"any"` | `"fixed"` | `"fixed"`: heading must appear in `top_level` order. `"any"`: order-agnostic. Only meaningful for level-2 sections. |
| `repeatable` | bool | `false` | If `true`, the heading may appear N times (e.g. repeating `### Story X — done` blocks under epic-context). |
| `lines_match` | string (JS RegExp) | — | If set, every non-blank, non-heading line under this section must match. Use JS `RegExp` syntax (the walker does `new RegExp(...)`). Escape backslashes: `^[\\s]*-` for "starts with a bullet". |
| `forbid_invented_sub_headings` | bool | `true` | If `true`, any direct sub-heading (level = section.level + 1) under this section that is not declared in this section's `sub_sections` → fail. Pre-6.9.0 the check used a flat global `declaredHeadings` set; since 6.9.0 it is parent-scoped (only this section's children are allowed). |
| `sub_sections` | object[] | `[]` | (6.9.0) Nested allowlist for direct children. Same shape as `sections[]` — recursive. Each entry must have `level = parent.level + 1`. Walker validates required-missing, invented children, and `lines_match` at every depth. Without `sub_sections`, behaviour is identical to 6.8.0 (no child structure expected). |
| `sub_sections_heading_pattern` | string (JS RegExp) | — | (6.11.0) Regex allowlist for direct children, applied alongside fixed `sub_sections[]`. A child is OK if it matches a declared `sub_sections[].heading` OR matches this pattern. Required-missing check fires only on declared fixed entries — pattern-matched children are accepted in any count (including zero). Use for variable-count entries like `### Component: <name>` under a parent that also has fixed L3 sub-sections. Invalid regex → exit 2. |

## Validator contract

Each `validate-<artefact>.sh` is a thin bash launcher around the Node walker:

```bash
exec node "$WALKER" "$SCHEMA" "$TARGET"
```

The walker exits `0` (conformant) or non-zero with `path:line — reason`
on stderr per mismatch. Failure shapes (stable — tests pin them):

| Class | Stderr line shape |
|---|---|
| Missing required heading | `path: missing required heading 'NAME'` |
| Invented top-level heading | `path:LN — invented top-level heading 'NAME' not in schema` |
| Invented sub-heading | `path:LN — invented heading 'NAME' not in schema` |
| Order violation | `path:LN — heading 'NAME' out of order (expected after 'PREV')` |
| Line shape violation | `path:LN — line does not match expected pattern under 'NAME'` |
| Schema parse error | `schema: REASON` (exit 2 — distinguishes from data failures) |
| Invalid `top_level_patterns` regex (6.11.0) | `schema: invalid top_level_patterns regex at index N: REASON` (exit 2) |
| Invalid `sub_sections_heading_pattern` regex (6.11.0) | `schema: invalid sub_sections_heading_pattern regex for 'NAME': REASON` (exit 2) |
| Target file missing | `path: file not found` (exit 2) |

## Out of scope (locked through 6.x)

- Regex allowlists for headings are limited to two well-defined slots: `top_level_patterns` (L2, schema-level) and `sub_sections_heading_pattern` (per-section, children only). No general `heading_pattern` field on arbitrary `sections[]` entries — the two slots above cover the actual cohort-3 needs (variable ADR count at L2, variable Component count at L3 under Phase 4) without inviting schema sprawl.
- No `oneOf` / `anyOf` choices — schemas are concrete shapes.
- No conditional rules ("if section X present then Y required") — caught by producer-side workflow logic, not the schema.
- No re-purposing as JSON-Schema-of-markdown — these manifests describe markdown structure, not JSON shape. JSON-Schema lives at `data/state.yaml.schema.v3.json` for `state.yaml`.

## Versioning

`version` starts at 1 per artefact. Incompatible changes (renamed heading,
tightened regex) bump the integer. Producers and validators ship from the same
package — no compat matrix to maintain.
