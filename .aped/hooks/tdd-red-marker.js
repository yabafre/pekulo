#!/usr/bin/env node
// APED tdd-red-marker — PostToolUse advisory hook (opt-in).
//
// Pocock workshop discipline (L1742-1769): TDD requires watching the test
// fail before writing the implementation. The aped-dev RED phase requires
// the agent to emit a literal `Confirmed RED: <test> failed at <file:line>
// — <reason>` token before any GREEN-phase Edit. This hook checks the
// recent transcript and emits an advisory when a non-test file is edited
// shortly after a test file edit but no `Confirmed RED:` witness token
// appeared in between.
//
// stdin:  PostToolUse JSON payload (tool_name, tool_input, transcript_path)
// stdout: hookSpecificOutput.additionalContext on advisory; empty on silent.
// exit:   0 always (advisory only).
//
// Failure modes (all silent — never block):
//   - transcript_path unreadable → silent (no signal to compare)
//   - target path resolution fails → silent
//   - test file detection ambiguous → silent (false-negative is OK)
import { readFileSync, statSync } from 'node:fs';

process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

// Files matching any of these patterns are treated as TEST files (RED-side
// of the cycle). Anything else is PRODUCTION code (GREEN-side, where the
// witness is mandatory).
const TEST_PATH_PATTERNS = [
  /\/tests?\//,
  /\/__tests__\//,
  /\/spec\//,
  /\/specs\//,
  /\.test\.[jt]sx?$/,
  /\.test\.py$/,
  /\.test\.go$/,
  /\.test\.rs$/,
  /\.spec\.[jt]sx?$/,
  /_test\.go$/,
  /_test\.py$/,
  /test_[^/]+\.py$/,
  /\.cy\.[jt]sx?$/,
  /\.e2e\.[jt]sx?$/,
];

// Files matching these are NEITHER test nor production — config, docs,
// schema. Skip the witness check entirely.
const NEUTRAL_PATH_PATTERNS = [
  /\/\.aped\//,
  /\.md$/,
  /\.json$/,
  /\.yaml$/,
  /\.yml$/,
  /\.toml$/,
  /\.lock$/,
  /\.gitignore$/,
  /\.env(\.|$)/,
  /\/CHANGELOG\b/i,
  /\/README\b/i,
];

function isTestFile(p) {
  return TEST_PATH_PATTERNS.some((rx) => rx.test(p));
}

function isNeutralFile(p) {
  return NEUTRAL_PATH_PATTERNS.some((rx) => rx.test(p));
}

// Read the last `maxLines` lines of `path`. The transcript file is JSONL —
// each line is a {"role": "...", "content": [...]} record. We don't parse
// each record; we just scan the raw text for `Confirmed RED:` and prior
// Write/Edit tool_use entries.
function tailFile(path, maxLines = 200) {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return '';
    const buf = readFileSync(path, 'utf-8');
    const lines = buf.split('\n');
    return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
  } catch {
    return '';
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = input ? JSON.parse(input) : {}; } catch { payload = {}; }

  const toolName = payload.tool_name || '';
  if (!/^(Write|Edit|MultiEdit)$/.test(toolName)) process.exit(0);

  const filePath = payload.tool_input?.file_path;
  if (!filePath) process.exit(0);

  // Test edits are fine — they're the RED-side of the cycle. The witness
  // token is required between a test edit and the FOLLOWING non-test edit.
  if (isTestFile(filePath)) process.exit(0);

  // Neutral files (docs, config) — skip silently. Editing CHANGELOG.md
  // shouldn't fire the advisory.
  if (isNeutralFile(filePath)) process.exit(0);

  // Need transcript_path to compare against. PostToolUse delivers it; if
  // absent (older Claude Code, or test fixture), skip.
  const transcriptPath = payload.transcript_path;
  if (!transcriptPath) process.exit(0);

  const tail = tailFile(transcriptPath, 200);
  if (!tail) process.exit(0);

  // Did the recent transcript edit a TEST file before this production edit?
  // Search for tool_use entries with file_path matching a test pattern.
  // Heuristic: look for `"file_path":"...test..."` style strings in the
  // tail. JSONL escapes embed quotes around the path so a simple regex
  // works without parsing each record.
  const recentTestEditRegex = /"file_path"\s*:\s*"([^"]*)"/g;
  let m;
  let recentTestEditFound = false;
  while ((m = recentTestEditRegex.exec(tail)) !== null) {
    if (isTestFile(m[1])) {
      recentTestEditFound = true;
      break;
    }
  }
  if (!recentTestEditFound) process.exit(0);

  // A test was edited recently. Check whether `Confirmed RED:` appeared
  // in the tail AFTER the test edit (we just check presence in the tail —
  // ordering is approximately right because transcript is append-only).
  if (/Confirmed RED:/.test(tail)) process.exit(0);

  // Production edit, after a test edit, with no witness token. Advise.
  const advisory =
    '[TDD-RED-MARKER] You just edited a non-test file (' + filePath + ') after a recent test-file edit, ' +
    'but no `Confirmed RED:` witness token appears in the recent transcript. ' +
    'Pocock\'s TDD discipline (workshop L1742-1769) requires WATCHING the test fail before writing the implementation. ' +
    'Re-run the test, capture the failure, and emit `Confirmed RED: <test-name> failed at <file:line> — <reason>` ' +
    'before continuing the GREEN phase. (See aped-dev.md § RED.) ' +
    'This advisory does not block your tool call — but if you skip it, the GATE check in aped-dev Self-Review will fail.';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: advisory,
    },
  }) + '\n');
  process.exit(0);
});
