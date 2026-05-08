#!/usr/bin/env node
// APED state MCP server (opt-in via `aped-method enable-mcp`).
//
// Vanilla Node implementation of the MCP protocol over stdio (JSON-RPC 2.0
// framed by Content-Length headers, like LSP). No external SDK dependency —
// the protocol surface is small enough to implement directly: initialize +
// tools/list + tools/call. Future tools join by extending the TOOLS map.
//
// Tools exposed:
//   aped_state.get(path?)         → typed read of a state.yaml subtree
//   aped_state.update(path,value) → atomic mutation; returns sha_before/after
//   aped_validate.phase(name)     → wraps oracle-{phase}.sh, returns violations
//
// Why these three first: each closes a documented hallucination class.
//   - get: replaces 5-7 round-trip Reads in skill Setup blocks
//   - update: prevents lost sibling keys + invented YAML paths
//   - validate.phase: deterministic oracle gate accessible as a typed call
//
// Storage:
//   - state.yaml at <projectRoot>/<output_path>/state.yaml (per config.yaml).
//   - YAML manipulation via `yq` subprocess (already a hard-required APED dep
//     for migrate-state.sh / sync-state.sh — re-using keeps the dep surface
//     unchanged).
//   - Concurrency: mkdir-as-mutex lock at <apedDir>/.mcp.lock with a 30 s
//     TTL. Every mutation acquires + releases. Stale lock (mtime > TTL) is
//     reaped on next acquire attempt.
//
// Failure modes (all return MCP errors with structured messages):
//   - state.yaml missing → tool error (not server crash)
//   - yq missing on host → tool error with install hint
//   - lock contention → tool error with retry-after suggestion
//   - schema validation failure (update with wrong shape) → tool error
//
// IMPORTANT: server NEVER spawns an llm. It is a pure structured-ops layer.
// The caller (the agent) decides what to do with the results. This matches
// the Anthropic "code-execution-with-mcp" article's anti-pattern warning
// that MCP servers must not become Turing-complete code-eval endpoints.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// ── Configuration discovery ────────────────────────────────────────────────
// CLAUDE_PROJECT_DIR is set by Claude Code when an MCP server runs in a
// project context. Fall back to PWD when invoked directly (tests / dev).
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const APED_DIR = process.env.APED_DIR || '.aped';
const CONFIG_PATH = join(PROJECT_ROOT, APED_DIR, 'config.yaml');

function readConfigField(key, fallback = '') {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const m = raw.match(new RegExp(`^${key}:\\s*['"]?([^'"\\n#]+?)['"]?\\s*(?:#.*)?$`, 'm'));
    return m ? m[1].trim() : fallback;
  } catch {
    return fallback;
  }
}

const OUTPUT_DIR = readConfigField('output_path', 'docs/aped');
const STATE_FILE = join(PROJECT_ROOT, OUTPUT_DIR, 'state.yaml');
const LOCK_DIR = join(PROJECT_ROOT, APED_DIR, '.mcp.lock');
const LOCK_TTL_MS = 30_000;

// ── yq shell helpers ───────────────────────────────────────────────────────
function yqAvailable() {
  const r = spawnSync('yq', ['--version'], { encoding: 'utf-8' });
  return r.status === 0;
}

function yqRead(yamlPath) {
  // Convert dot-path to yq selector. `pipeline.phases.architecture.status`
  // → `.pipeline.phases.architecture.status`. Empty path = whole doc.
  const selector = yamlPath ? '.' + yamlPath : '.';
  const r = spawnSync('yq', ['eval', selector, STATE_FILE], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new ToolError(`yq read failed: ${r.stderr.trim() || 'unknown error'}`, 'YQ_READ');
  }
  return r.stdout.trimEnd();
}

function yqWrite(yamlPath, value) {
  const selector = '.' + yamlPath;
  // yq strict eval-in-place. Coerce value to YAML literal:
  //   - strings → '"value"'
  //   - numbers/bool → bare
  //   - objects/arrays → JSON stringify (yq parses JSON inside YAML)
  let yamlValue;
  if (value === null) yamlValue = 'null';
  else if (typeof value === 'string') yamlValue = JSON.stringify(value);
  else if (typeof value === 'number' || typeof value === 'boolean') yamlValue = String(value);
  else yamlValue = JSON.stringify(value);

  const expr = `${selector} = ${yamlValue}`;
  const r = spawnSync('yq', ['eval', '-i', expr, STATE_FILE], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new ToolError(`yq write failed: ${r.stderr.trim() || 'unknown error'}`, 'YQ_WRITE');
  }
}

function fileSha() {
  if (!existsSync(STATE_FILE)) return null;
  const buf = readFileSync(STATE_FILE);
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

// ── Lock helpers ───────────────────────────────────────────────────────────
function tryLock(scope = 'state-update', ttlMs = LOCK_TTL_MS) {
  // Check for stale lock first. mkdirSync is atomic — wins exactly one
  // concurrent acquirer.
  if (existsSync(LOCK_DIR)) {
    try {
      const age = Date.now() - statSync(LOCK_DIR).mtimeMs;
      if (age > ttlMs) {
        rmdirSync(LOCK_DIR);
      }
    } catch {
      // race: another process reaped it; try anyway
    }
  }
  try {
    mkdirSync(LOCK_DIR, { recursive: false });
    return { ok: true, scope };
  } catch (e) {
    if (e.code === 'EEXIST') {
      return { ok: false, error: 'lock-contention', retry_after_ms: 250 };
    }
    throw e;
  }
}

function unlock() {
  try {
    rmdirSync(LOCK_DIR);
  } catch {
    // missing lock is benign — never fail an unlock.
  }
}

// ── Tool error envelope ────────────────────────────────────────────────────
class ToolError extends Error {
  constructor(message, code = 'INTERNAL', details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// ── Schema constants (5.2.0: single source of truth in state-schema.mjs) ──
import {
  TOP_LEVEL_KEYS as _TOP_LEVEL_KEYS_ARR,
  PHASES,
  STATUSES,
  LEGAL_TRANSITIONS as _LEGAL_TRANSITIONS_ARR,
  PHASE_ARTEFACTS,
} from './state-schema.mjs';
const TOP_LEVEL_KEYS = new Set(_TOP_LEVEL_KEYS_ARR);
const LEGAL_TRANSITIONS = new Set(_LEGAL_TRANSITIONS_ARR);

// ── Tool implementations ───────────────────────────────────────────────────
const TOOLS = {
  'aped_state.get': {
    description:
      'Read a sub-tree of state.yaml by dot-path. Empty path returns the full document. ' +
      'Returns { value, sha, schema_version } where sha is a content hash the caller ' +
      'can pass back as expect_sha to detect concurrent modification.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Dot-path into state.yaml (e.g. "pipeline.phases.architecture"). Empty = full doc.',
        },
      },
      required: [],
    },
    handler: ({ path = '' }) => {
      if (!yqAvailable()) {
        throw new ToolError('yq not installed on this host. Install via `brew install yq` (macOS) or `npm i -g yq`.', 'NO_YQ');
      }
      if (!existsSync(STATE_FILE)) {
        throw new ToolError(`state.yaml not found at ${STATE_FILE}. Run aped-method scaffold first.`, 'NO_STATE');
      }
      const raw = yqRead(path);
      // yq returns "null" for missing keys. Surface that explicitly.
      if (raw === 'null') {
        return { value: null, sha: fileSha(), schema_version: parseSchemaVersion() };
      }
      // Try to JSON-parse if yq output looks JSON-ish (objects/arrays).
      // For scalars yq emits the bare value.
      let parsed = raw;
      try {
        if (raw.startsWith('{') || raw.startsWith('[')) {
          parsed = JSON.parse(raw);
        }
      } catch {
        parsed = raw;
      }
      return {
        value: parsed,
        sha: fileSha(),
        schema_version: parseSchemaVersion(),
      };
    },
  },

  'aped_state.update': {
    description:
      'Atomic mutation of state.yaml by dot-path. Acquires the MCP lock, validates ' +
      'the path exists (top-level keys are allow-listed against the canonical schema), ' +
      'writes via yq, returns sha_before/sha_after. Pass expect_sha to fail-fast on ' +
      'concurrent modification.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dot-path of the field to update (must be non-empty).' },
        value: { description: 'New value. Strings, numbers, booleans, objects, arrays, null all supported.' },
        expect_sha: {
          type: 'string',
          description: 'Optional: the sha returned by a prior aped_state.get. If present and the file has changed, the update is refused with CONFLICT.',
        },
      },
      required: ['path'],
    },
    handler: ({ path, value, expect_sha = null }) => {
      if (!path) throw new ToolError('path is required for update', 'BAD_INPUT');
      if (!yqAvailable()) {
        throw new ToolError('yq not installed on this host. Install via `brew install yq` (macOS) or `npm i -g yq`.', 'NO_YQ');
      }
      if (!existsSync(STATE_FILE)) {
        throw new ToolError(`state.yaml not found at ${STATE_FILE}.`, 'NO_STATE');
      }

      const top = path.split('.')[0];
      if (!TOP_LEVEL_KEYS.has(top)) {
        throw new ToolError(
          `top-level key '${top}' is not in the canonical state.yaml schema. ` +
          `Allowed: ${[...TOP_LEVEL_KEYS].join(', ')}. ` +
          `If this is a new schema field, update the allowlist in aped-state-server.mjs and bump schema_version.`,
          'SCHEMA_REJECT',
        );
      }

      // Concurrency check via expect_sha BEFORE acquiring the lock.
      const shaBefore = fileSha();
      if (expect_sha && expect_sha !== shaBefore) {
        throw new ToolError(
          `expect_sha mismatch — state.yaml changed since you read it. ` +
          `Re-read with aped_state.get and retry with the new sha. ` +
          `(expected ${expect_sha}, got ${shaBefore})`,
          'CONFLICT',
          { expect_sha, actual_sha: shaBefore },
        );
      }

      // Acquire lock. On contention, surface to the caller — never block
      // the MCP request loop indefinitely.
      const lock = tryLock();
      if (!lock.ok) {
        throw new ToolError(
          'state.yaml lock held by another process. Retry in a moment.',
          'LOCK_CONTENTION',
          { retry_after_ms: lock.retry_after_ms },
        );
      }

      try {
        yqWrite(path, value);
        const shaAfter = fileSha();
        return {
          ok: true,
          sha_before: shaBefore,
          sha_after: shaAfter,
          path,
          value,
        };
      } finally {
        unlock();
      }
    },
  },

  'aped_validate.phase': {
    description:
      'Run the canonical oracle for a phase. Wraps oracle-{phase}.sh in a ' +
      'typed MCP call. Returns { ok, violations[] } where each violation is the ' +
      'parsed `ERROR <code>: <reason>` line. Supported: prd, arch, epics (4.12.0), dev, qa, state (4.16.0).',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['prd', 'arch', 'epics', 'dev', 'qa', 'state'],
          description: 'Phase to validate. Maps to <apedDir>/aped-{phase}/scripts/oracle-{phase}.sh.',
        },
      },
      required: ['phase'],
    },
    handler: ({ phase }) => {
      const SUPPORTED = ['prd', 'arch', 'epics', 'dev', 'qa', 'state'];
      if (!SUPPORTED.includes(phase)) {
        throw new ToolError(`unsupported phase: ${phase}. Supported: ${SUPPORTED.join(', ')}`, 'BAD_INPUT');
      }

      const oracleDir = phase === 'state' ? 'aped-state' : `aped-${phase}`;
      const oracle = join(PROJECT_ROOT, APED_DIR, oracleDir, 'scripts', `oracle-${phase}.sh`);
      if (!existsSync(oracle)) {
        throw new ToolError(`oracle script missing at ${oracle}. Re-scaffold with aped-method to install it.`, 'NO_ORACLE');
      }

      const prdFile = join(PROJECT_ROOT, OUTPUT_DIR, 'prd.md');
      const archFile = join(PROJECT_ROOT, OUTPUT_DIR, 'architecture.md');
      const epicsFile = join(PROJECT_ROOT, OUTPUT_DIR, 'epics.md');
      const storyFile = join(PROJECT_ROOT, OUTPUT_DIR, 'story.md');
      const apedDirAbs = join(PROJECT_ROOT, APED_DIR);

      let args;
      if (phase === 'prd') args = [oracle, prdFile];
      else if (phase === 'arch') args = [oracle, archFile, prdFile];
      else if (phase === 'epics') args = [oracle, epicsFile, prdFile];
      else if (phase === 'dev') args = [oracle, storyFile, apedDirAbs];
      else if (phase === 'qa') args = [oracle, 'default-key', apedDirAbs];
      else args = [oracle, apedDirAbs];

      const r = spawnSync('bash', args, { encoding: 'utf-8' });
      const stdout = r.stdout || '';
      const violations = stdout
        .split('\n')
        .filter((l) => l.startsWith('ERROR '))
        .map((l) => {
          const m = l.match(/^ERROR (E\d+):\s*(.*)$/);
          if (!m) return { code: 'E_UNKNOWN', message: l };
          return { code: m[1], message: m[2] };
        });

      return {
        ok: r.status === 0,
        phase,
        oracle: `<apedDir>/aped-${phase}/scripts/oracle-${phase}.sh`,
        violations,
        // Pass through OK summary line for human consumption.
        summary: stdout.split('\n').find((l) => l.startsWith('OK ')) || null,
      };
    },
  },
  'aped_context.load': {
    description:
      'Load the artefact bundle for a pipeline phase. Returns file paths, sizes, and ' +
      'existence status. Replaces 5-7 round-trip Read calls in skill Setup blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: Object.keys(PHASE_ARTEFACTS),
          description: 'Pipeline phase whose artefacts to load.',
        },
      },
      required: ['phase'],
    },
    handler: ({ phase }) => {
      if (!PHASE_ARTEFACTS[phase]) {
        throw new ToolError(`Unknown phase '${phase}'.`, 'UNKNOWN_PHASE');
      }
      const names = PHASE_ARTEFACTS[phase];
      const artefacts = [];
      const missing = [];
      for (const name of names) {
        const fullPath = join(PROJECT_ROOT, OUTPUT_DIR, name);
        if (existsSync(fullPath)) {
          const stat = statSync(fullPath);
          artefacts.push({ path: join(OUTPUT_DIR, name), size_bytes: stat.size, exists: true });
        } else {
          missing.push({ path: join(OUTPUT_DIR, name), exists: false });
        }
      }
      return { phase, artefacts, missing };
    },
  },

  'aped_state.advance': {
    description:
      'Composed phase transition. Updates pipeline.current_phase + pipeline.phases.<phase>.status ' +
      'atomically under one lock. Validates the transition against the canonical state machine.',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: PHASES,
          description: 'Pipeline phase to transition.',
        },
        status: {
          type: 'string',
          enum: STATUSES,
          description: 'Target status for the phase.',
        },
        completed_subphase: {
          type: 'string',
          description: 'Optional: mark a subphase as completed (e.g. "self-review").',
        },
        expect_sha: {
          type: 'string',
          description: 'Optional: sha from a prior get. Fails with CONFLICT if state.yaml changed.',
        },
      },
      required: ['phase', 'status'],
    },
    handler: ({ phase, status, completed_subphase, expect_sha }) => {
      if (!PHASES.includes(phase)) {
        throw new ToolError(`Unknown phase '${phase}'. Legal: ${PHASES.join(', ')}`, 'INVALID_PHASE');
      }
      if (!STATUSES.includes(status)) {
        throw new ToolError(`Unknown status '${status}'. Legal: ${STATUSES.join(', ')}`, 'INVALID_STATUS');
      }
      if (!yqAvailable()) throw new ToolError('yq not installed.', 'NO_YQ');
      if (!existsSync(STATE_FILE)) throw new ToolError('state.yaml not found.', 'NO_STATE');

      const rawStatus = yqRead(`pipeline.phases.${phase}.status`);
      const currentStatus = (!rawStatus || rawStatus === 'null') ? 'not-started' : rawStatus;
      const transKey = `${currentStatus}→${status}`;
      if (!LEGAL_TRANSITIONS.has(transKey)) {
        throw new ToolError(
          `Illegal transition: ${phase} ${currentStatus} → ${status}. ` +
          `Legal from '${currentStatus}': ${[...LEGAL_TRANSITIONS].filter(t => t.startsWith(currentStatus + '→')).map(t => t.split('→')[1]).join(', ') || 'none'}`,
          'ILLEGAL_TRANSITION',
        );
      }

      const lock = tryLock();
      if (!lock.ok) throw new ToolError('Lock held by another process.', 'LOCK_CONTENTION', lock);
      try {
        const shaBefore = fileSha();
        if (expect_sha && expect_sha !== shaBefore) {
          throw new ToolError(`expect_sha mismatch (expected ${expect_sha}, got ${shaBefore})`, 'CONFLICT');
        }
        yqWrite('pipeline.current_phase', phase);
        yqWrite(`pipeline.phases.${phase}.status`, status);
        if (completed_subphase) {
          yqWrite(`pipeline.phases.${phase}.completed_subphase`, completed_subphase);
        }
        return {
          ok: true,
          sha_before: shaBefore,
          sha_after: fileSha(),
          transitioned: { phase, from: currentStatus, to: status },
        };
      } finally {
        unlock();
      }
    },
  },

  'aped_state.lock': {
    description:
      'Acquire an explicit cross-call mutex on state.yaml. Returns a token the caller ' +
      'must pass to aped_state.unlock. Use for multi-step operations (e.g. aped-ship ' +
      'Integration Check) that need exclusive access across multiple tool calls.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Label for observability (e.g. "ship-pr").' },
        ttl_ms: { type: 'number', description: 'Lock TTL in ms (default 30000, max 300000).' },
      },
      required: [],
    },
    handler: ({ scope = 'default', ttl_ms = LOCK_TTL_MS }) => {
      if (ttl_ms > 300_000) {
        throw new ToolError('TTL exceeds 5 minutes (300000ms).', 'TTL_TOO_LONG');
      }
      const lock = tryLock(scope, ttl_ms);
      if (!lock.ok) {
        throw new ToolError('Lock held by another process.', 'LOCK_CONTENTION', lock);
      }
      const token = createHash('sha256')
        .update(`${process.pid}-${Date.now()}-${Math.random()}`)
        .digest('hex')
        .slice(0, 16);
      try {
        writeFileSync(join(LOCK_DIR, 'owner.json'), JSON.stringify({ token, scope, pid: process.pid }));
      } catch {
        unlock();
        throw new ToolError('Failed to write lock owner.', 'INTERNAL');
      }
      return { token, scope, expires_at: Date.now() + ttl_ms };
    },
  },

  'aped_state.unlock': {
    description:
      'Release a lock acquired via aped_state.lock. Requires the token from the lock response.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token from the aped_state.lock response.' },
      },
      required: ['token'],
    },
    handler: ({ token }) => {
      if (!token) throw new ToolError('Token is required.', 'BAD_INPUT');
      if (!existsSync(LOCK_DIR)) return { ok: true, released: false };
      const ownerFile = join(LOCK_DIR, 'owner.json');
      if (existsSync(ownerFile)) {
        try {
          const owner = JSON.parse(readFileSync(ownerFile, 'utf-8'));
          if (owner.token !== token) {
            throw new ToolError(
              `Token mismatch — lock owned by another caller (scope: ${owner.scope}).`,
              'LOCK_NOT_OWNED',
            );
          }
        } catch (e) {
          if (e instanceof ToolError) throw e;
        }
      }
      unlock();
      return { ok: true, released: true };
    },
  },

  'aped_state.describe': {
    description:
      'Returns the canonical state.yaml schema: top-level keys, pipeline phases, ' +
      'legal status values, and the transition table. Use this to introspect what ' +
      'aped_state.advance accepts before calling it.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => {
      return {
        schema_version: existsSync(STATE_FILE) ? parseSchemaVersion() : null,
        top_level_keys: [...TOP_LEVEL_KEYS],
        phases: PHASES,
        statuses: STATUSES,
        legal_transitions: [...LEGAL_TRANSITIONS].map((t) => {
          const [from, to] = t.split('→');
          return { from, to };
        }),
      };
    },
  },
};

function parseSchemaVersion() {
  try {
    return parseInt(yqRead('schema_version'), 10) || 1;
  } catch {
    return 1;
  }
}

// ── MCP protocol implementation (JSON-RPC 2.0 over stdio) ──────────────────
//
// Spec: https://spec.modelcontextprotocol.io/specification/
// Minimal surface for tools-only servers:
//   1. initialize → returns protocol + capabilities
//   2. tools/list → returns descriptors
//   3. tools/call → invokes a tool by name
//
// Errors are returned in the standard JSON-RPC error envelope with the MCP
// `data` field carrying the structured error code + details.

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'aped-state', version: '1.0.0' };

function handleInitialize() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO,
  };
}

function handleToolsList() {
  return {
    tools: Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  };
}

function handleToolsCall(params) {
  const { name, arguments: args = {} } = params;
  const tool = TOOLS[name];
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  try {
    const result = tool.handler(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    if (e instanceof ToolError) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({ error: e.code, message: e.message, details: e.details }, null, 2),
        }],
      };
    }
    return {
      isError: true,
      content: [{ type: 'text', text: `Internal error: ${e.message}` }],
    };
  }
}

function dispatch(request) {
  const { id, method, params = {} } = request;
  let result;
  try {
    if (method === 'initialize') result = handleInitialize();
    else if (method === 'tools/list') result = handleToolsList();
    else if (method === 'tools/call') result = handleToolsCall(params);
    else if (method === 'notifications/initialized') return null; // no response
    else if (method === 'ping') result = {};
    else {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    }
    return { jsonrpc: '2.0', id, result };
  } catch (e) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal error', data: { message: e.message } },
    };
  }
}

// ── stdio transport ────────────────────────────────────────────────────────
//
// MCP over stdio uses newline-delimited JSON (NOT Content-Length framing —
// that's LSP). Each message is one JSON object on a single line, terminated
// by \n. We read line-by-line.

function setupStdio() {
  let buffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      let req;
      try {
        req = JSON.parse(line);
      } catch (e) {
        process.stderr.write(`[aped-state] parse error: ${e.message}\n`);
        continue;
      }
      const res = dispatch(req);
      if (res) {
        process.stdout.write(JSON.stringify(res) + '\n');
      }
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

// Crash safety: any uncaught error in handlers should be logged but never
// kill the MCP server (the parent agent loses tools entirely if we die).
process.on('uncaughtException', (e) => {
  process.stderr.write(`[aped-state] uncaught: ${e.message}\n${e.stack}\n`);
});
process.on('unhandledRejection', (r) => {
  process.stderr.write(`[aped-state] unhandled rejection: ${r}\n`);
});

// Allow the server to be imported (for tests) without auto-starting.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  setupStdio();
}

// Test surface — exported so tests/mcp-state-server.test.js can dispatch
// requests directly without spawning a subprocess.
export { dispatch, TOOLS, ToolError, PHASES, STATUSES, LEGAL_TRANSITIONS, PHASE_ARTEFACTS };
