#!/usr/bin/env node
// APED verify-claims — PostToolUse advisory hook (opt-in).
//
// Scans the most recent Bash tool response for forbidden completion phrases
// ("should work", "looks good", "Done!", etc.) and emits an advisory when a
// phrase appears WITHOUT a concrete evidence line within the previous N
// lines (configurable via verify_claims.evidence_window in config.yaml,
// default 30). Never blocks tool use.
//
// stdin:  PostToolUse JSON payload (tool_name, tool_input, tool_response.output)
// stdout: hookSpecificOutput.additionalContext on advisory; empty on silent.
// exit:   0 always (advisory only).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// Advisory contract: never crash, never block on internal failure. Any
// uncaught error in the hook itself exits 0 silently so the user's Bash
// invocation is not affected by hook bugs.
process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

// Forbidden completion-claim phrases. Each entry is paired with a regex that
// asserts word-boundary or exact-form matching where the phrase is short
// enough to false-positive inside other words (e.g. "Done!" inside "doneness"
// — exclamation marker disambiguates) or as a substring of a longer phrase
// (e.g. "should work" inside "tests should pass" — kept as separate rules so
// the longer, more specific phrase wins when both match the same line).
const FORBIDDEN_PHRASES = [
  { name: 'should work', re: /\bshould work\b/i },
  { name: 'looks good', re: /\blooks good\b/i },
  { name: 'probably fine', re: /\bprobably fine\b/i },
  { name: 'tests should pass', re: /\btests should pass\b/i },
  { name: 'should be ok', re: /\bshould be ok(?:ay)?\b/i },
  // Punctuated exclamations are *less* likely to occur as substrings of real
  // prose; we anchor on the punctuation to keep recall high without firing
  // on words like "doneness" or "perfectly" that share the prefix.
  { name: 'Done!', re: /\bDone!\B/ },
  { name: 'Great!', re: /\bGreat!\B/ },
  { name: 'Perfect!', re: /\bPerfect!\B/ },
  { name: 'All set', re: /\bAll set\b/i },
];

// Lines that count as concrete evidence. Conservative — false negatives are
// preferable to false positives (we'd rather skip an advisory than fire on
// real evidence).
const EVIDENCE_PATTERNS = [
  /^\s*PASS\b/i,
  /^\s*FAIL\b/i,
  /^\s*OK\b/,
  /^\s*ERR\b/,
  /^\s*Tests?:\s*\d+\s+passed\b/i,
  /^\s*\d+\s+test(s)?\s+passed\b/i,
  /^\s*✓\s/,
  /^\s*✗\s/,
  /^\s*\d+\s+passing\b/i,
  /\bexit\s+code\s*[:=]?\s*0\b/i,
];

function readStdin() {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function projectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

// Read the verify_claims block from APED config. Same shape and parser as
// the placeholder lint kill switch.
function readConfig(root) {
  const candidates = [
    join(root, '.aped', 'config.yaml'),
    join(root, '.aped', 'config.yaml'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const text = readFileSync(path, 'utf-8');
      return parseVerifyClaimsBlock(text);
    } catch {
      // ignore
    }
  }
  return { enabled: true, evidenceWindow: 30 };
}

function parseVerifyClaimsBlock(text) {
  const lines = text.split('\n');
  let inBlock = false;
  let enabled = true;
  let evidenceWindow = 30;
  for (const raw of lines) {
    if (/^verify_claims:\s*$/.test(raw)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^[^\s]/.test(raw)) {
      // top-level key — out of block
      inBlock = false;
      continue;
    }
    if (!inBlock) continue;
    let m = raw.match(/^  enabled:\s*([^#]*?)\s*(#.*)?$/);
    if (m) {
      const val = m[1].replace(/['"]/g, '').trim();
      enabled = val !== 'false';
      continue;
    }
    m = raw.match(/^  evidence_window:\s*([^#]*?)\s*(#.*)?$/);
    if (m) {
      // 0 is a documented sentinel: "skip the window check, scan phrases only
      // and treat any forbidden phrase as offending regardless of preceding
      // evidence". Negative numbers are coerced to 0 (pure phrase scan).
      const n = parseInt(m[1].replace(/['"]/g, '').trim(), 10);
      if (Number.isFinite(n) && n >= 0) evidenceWindow = n;
      continue;
    }
  }
  return { enabled, evidenceWindow };
}

function looksLikeEvidence(line) {
  return EVIDENCE_PATTERNS.some((rx) => rx.test(line));
}

// For each forbidden phrase hit, check whether evidence appears either
// (a) within `windowSize` lines BEFORE the hit, OR (b) on the SAME line as
// the hit. Same-line evidence handles outputs like "PASS: should work as
// expected" where the pass marker precedes the matched phrase by characters
// rather than lines.
//
// `windowSize === 0` disables the window check entirely — every forbidden
// phrase counts as an offence regardless of context, except when same-line
// evidence is present.
function findOffenders(text, windowSize) {
  const lines = text.split('\n');
  const offenders = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const phrase of FORBIDDEN_PHRASES) {
      if (phrase.re.test(line)) {
        // Same-line evidence — strongest signal; never advise.
        if (looksLikeEvidence(line)) continue;
        if (windowSize > 0) {
          const start = Math.max(0, i - windowSize);
          const window = lines.slice(start, i);
          if (window.some(looksLikeEvidence)) continue;
        }
        offenders.push({ phrase: phrase.name, lineNumber: i + 1, line });
      }
    }
  }
  return offenders;
}

function main() {
  const payload = parsePayload(readStdin());
  // Only meaningful for Bash and similar tools that produce text output.
  // Other tool responses are skipped silently.
  const toolName = payload.tool_name || '';
  if (!/^Bash$/i.test(toolName)) {
    process.exit(0);
  }

  // Bash output may live under `output` (legacy/string), `stdout` (newer split
  // shape), or `stderr` (when the command failed and only stderr produced
  // text). Concatenate stdout+stderr when both are present so a forbidden
  // phrase shipped via stderr is still caught.
  const tr = payload.tool_response || {};
  const parts = [];
  if (typeof tr.output === 'string' && tr.output) parts.push(tr.output);
  if (typeof tr.stdout === 'string' && tr.stdout) parts.push(tr.stdout);
  if (typeof tr.stderr === 'string' && tr.stderr) parts.push(tr.stderr);
  const output = parts.join('\n');
  if (!output) process.exit(0);

  const config = readConfig(projectRoot());
  if (!config.enabled) process.exit(0);

  const offenders = findOffenders(output, config.evidenceWindow);
  if (offenders.length === 0) process.exit(0);

  // Build a single advisory. Cap to first 3 hits to avoid context flooding.
  const shown = offenders.slice(0, 3);
  const lines = [
    '[VERIFY-CLAIMS] Forbidden completion phrase(s) found in Bash output without concrete evidence within the preceding ' + config.evidenceWindow + ' lines:',
  ];
  for (const o of shown) {
    lines.push(`  line ${o.lineNumber}: "${o.phrase}" — ${o.line.trim().slice(0, 120)}`);
  }
  if (offenders.length > shown.length) {
    lines.push(`  ...and ${offenders.length - shown.length} more.`);
  }
  lines.push('Re-run the verification and capture the actual output (PASS/FAIL line, exit code, or test count) in your next message before claiming completion.');

  const ctx = lines.join('\n');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  }) + '\n');
  process.exit(0);
}

main();
