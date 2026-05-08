# Markdown Schema DSL

Structural contract for APED markdown artefacts. One JSON manifest per artefact;
one validator script per manifest; one shared Node walker behind them.

Designed for "walk markdown headings + check section content" — narrow on purpose.
Extensions land in a future MINOR after a design pass. Locked field set in 6.3.0.

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
| `top_level` | string[] | — | Ordered allowlist of `## ` headings. Any `## X` in the target outside this list is "invented" → fail. Mandatory. |
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
| `forbid_invented_sub_headings` | bool | `true` | If `true`, any sub-heading (level > section.level) under this section that is not declared in `sections` → fail. |

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
| Target file missing | `path: file not found` (exit 2) |

## Out of scope (locked, do not extend in 6.3.0)

- No nested `sections` (sub-section content rules use a flat list with explicit `level` + `forbid_invented_sub_headings` instead).
- No `oneOf` / `anyOf` choices — schemas are concrete shapes.
- No conditional rules ("if section X present then Y required") — caught by producer-side workflow logic, not the schema.
- No re-purposing as JSON-Schema-of-markdown — these manifests describe markdown structure, not JSON shape. JSON-Schema lives at `data/state.yaml.schema.v3.json` for `state.yaml`.

## Versioning

`version` starts at 1 per artefact. Incompatible changes (renamed heading,
tightened regex) bump the integer. Producers and validators ship from the same
package — no compat matrix to maintain.
