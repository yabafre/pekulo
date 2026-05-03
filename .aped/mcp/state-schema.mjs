// Canonical state.yaml schema constants — single source of truth.
// Consumed by aped-state-server.mjs (MCP) and validate-state.sh (bash oracle).
// When adding a new top-level key, update ONLY this file.

export const SCHEMA_VERSION = 2;

export const TOP_LEVEL_KEYS = [
  'schema_version', 'project_name', 'pipeline', 'sprint',
  'corrections_pointer', 'corrections_count', 'lead', 'mcp',
];

export const PHASES = [
  'none', 'brainstorm', 'prd', 'arch', 'epics',
  'stories', 'dev', 'review', 'ship', 'retro',
];

export const STATUSES = ['not-started', 'in-progress', 'complete', 'blocked'];

export const LEGAL_TRANSITIONS = [
  'not-started→in-progress',
  'in-progress→complete',
  'in-progress→blocked',
  'blocked→in-progress',
  'complete→complete',
  'not-started→not-started',
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
