// Canonical state.yaml schema constants — single source of truth.
// Consumed by aped-state-server.mjs (MCP) and validate-state.sh (bash oracle).
// When adding a new top-level key, update ONLY this file.

export const SCHEMA_VERSION = 2;

export const TOP_LEVEL_KEYS = [
  'schema_version', 'project_name', 'pipeline', 'sprint',
  'corrections_pointer', 'corrections_count', 'lead', 'mcp',
];

export const PHASES = [
  'none', 'brainstorm', 'prd', 'ux', 'arch', 'epics',
  'stories', 'dev', 'review', 'ship', 'retro',
];

// STATUSES are EXPANDed in 6.4.1 to admit the downstream-signal vocabulary
// skills already emit (`done` as alias for `complete`; `ready-for-dev` and
// `review` as cross-phase handoff signals). CANONICALIZE (rewrite the 5
// skills to use `complete`/`in-progress` only) is scheduled for 6.5+. The
// mcp-vocab-roundtrip test locks the contract against further drift.
export const STATUSES = [
  'not-started', 'in-progress', 'ready-for-dev', 'review',
  'complete', 'done', 'blocked',
];

// `done` is an alias for `complete` retained for skill-prose stability — every
// transition admitting one admits the other (symmetric). `ready-for-dev` and
// `review` are intra-pipeline handoff signals with forward exits to terminal
// states. CANONICALIZE scheduled for 6.5+ collapses the alias and rewrites
// the 5 skill call-sites that emit the downstream-signal vocabulary.
export const LEGAL_TRANSITIONS = [
  'not-started→in-progress',
  'not-started→not-started',
  'in-progress→complete',
  'in-progress→done',
  'in-progress→ready-for-dev',
  'in-progress→review',
  'in-progress→blocked',
  'ready-for-dev→in-progress',
  'ready-for-dev→complete',
  'ready-for-dev→done',
  'ready-for-dev→review',
  'review→in-progress',
  'review→complete',
  'review→done',
  'review→blocked',
  'complete→complete',
  'complete→done',
  'done→complete',
  'done→done',
  'done→blocked',
  'complete→blocked',
  'blocked→in-progress',
  'blocked→blocked',
];

export const PHASE_ARTEFACTS = {
  brainstorm: ['brainstorm.md'],
  prd: ['project-context.md', 'prd.md'],
  arch: ['prd.md', 'project-context.md', 'architecture.md'],
  epics: ['prd.md', 'architecture.md', 'epics.md'],
  stories: ['prd.md', 'architecture.md', 'epics.md'],
  dev: ['story.md', 'prd.md', 'architecture.md'],
  review: ['prd.md', 'architecture.md', 'story.md'],
  ship: ['prd.md', 'epics.md'],
  retro: ['prd.md', 'epics.md'],
};
