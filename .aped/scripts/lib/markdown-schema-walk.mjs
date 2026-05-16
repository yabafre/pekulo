#!/usr/bin/env node
// markdown-schema-walk — APED structural validator for markdown artefacts.
// Usage: node markdown-schema-walk.mjs <schema.json> <target.md>
// Exit 0 conformant, 1 drift, 2 schema/target unreadable.
// Failure shapes (stable — pinned by tests):
//   path: missing required heading 'NAME'                       (level-2)
//   path: missing required heading 'NAME' under 'PARENT'        (level-3+, 6.9.0)
//   path:LN — invented top-level heading 'NAME' not in schema
//   path:LN — invented heading 'NAME' not in schema
//   path:LN — heading 'NAME' out of order (expected after 'PREV')
//   path:LN — line does not match expected pattern under 'NAME'
//   schema: REASON         (exit 2)
//   path: file not found   (exit 2)
//
// 6.9.0 — schemas may declare `sub_sections[]` on any section (recursive shape:
// same fields as `sections[]`, nested). The walker walks the heading tree
// depth-first; each section validates only its declared sub_sections
// (parent-scoped allowlist) instead of the legacy flat declaredHeadings set.
//
// 6.11.0 — schemas may declare `top_level_patterns: string[]` (regex allowlist
// for L2 names alongside fixed `top_level`) and `sub_sections_heading_pattern`
// per section (regex allowlist for direct children, coexists with fixed
// `sub_sections[]`). Pattern-matched L2 entries are accepted as valid but DO
// NOT advance the fixed-order cursor — they may appear in any position, in
// any count (including zero). Both fields are optional; cohort-1/2/3a schemas
// behave identically without them.

import { readFileSync } from 'node:fs';

const [, , schemaPath, targetPath] = process.argv;
if (!schemaPath || !targetPath) {
  process.stderr.write('Usage: node markdown-schema-walk.mjs <schema.json> <target.md>\n');
  process.exit(2);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
} catch (err) {
  if (err.code === 'ENOENT') {
    process.stderr.write(`schema: file not found: ${schemaPath}\n`);
  } else {
    process.stderr.write(`schema: parse error (${err.message})\n`);
  }
  process.exit(2);
}

let raw;
try {
  raw = readFileSync(targetPath, 'utf8');
} catch (err) {
  if (err.code === 'ENOENT') {
    process.stderr.write(`${targetPath}: file not found\n`);
  } else {
    process.stderr.write(`${targetPath}: ${err.message}\n`);
  }
  process.exit(2);
}

const lines = raw.split('\n');

// Walk headings → [{ line, level, text }, ...]
const HEADING = /^(#+)\s+(.+?)\s*$/;
const headings = [];
let inFence = false;
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  if (/^```/.test(ln)) inFence = !inFence;
  if (inFence) continue;
  const m = HEADING.exec(ln);
  if (m) headings.push({ line: i + 1, level: m[1].length, text: m[2] });
}

const topLevel = Array.isArray(schema.top_level) ? schema.top_level : [];
const sections = Array.isArray(schema.sections) ? schema.sections : [];
const allowedTop = new Set(topLevel);

// 6.11.0 — `top_level_patterns` (string[] of regex source) compiled once.
// Schema error → exit 2 with a stable message. Pattern-matched L2 headings
// are accepted but skipped from the fixed-order cursor.
const topLevelPatterns = Array.isArray(schema.top_level_patterns)
  ? schema.top_level_patterns
  : [];
const topLevelRegexes = topLevelPatterns.map((pat, i) => {
  try {
    return new RegExp(pat);
  } catch (err) {
    process.stderr.write(
      `schema: invalid top_level_patterns regex at index ${i}: ${err.message}\n`,
    );
    process.exit(2);
  }
});
const matchesTopPattern = (text) => topLevelRegexes.some((r) => r.test(text));

let exitCode = 0;
const fail = (msg) => {
  process.stderr.write(msg + '\n');
  exitCode = 1;
};

// 1. Invented top-level + 2. Order check — both gated on top_level presence.
// When the schema omits top_level (or sets []), we skip these checks. Used
// by artefacts whose level-2 names are open-ended (e.g. epics.md has
// "## Epic 1: ..." / "## Epic 2: ..." headings whose count varies per
// project; only "## FR Coverage Map" is universally required).
const targetTop = headings.filter((h) => h.level === 2);
if (topLevel.length > 0 || topLevelRegexes.length > 0) {
  for (const h of targetTop) {
    if (allowedTop.has(h.text)) continue;
    if (matchesTopPattern(h.text)) continue;
    fail(`${targetPath}:${h.line} — invented top-level heading '${h.text}' not in schema`);
  }

  let ptr = 0;
  let prev = '<start>';
  for (const h of targetTop) {
    // Pattern-only matches skip the order cursor (free position, free count).
    if (!allowedTop.has(h.text)) continue;
    let moved = false;
    while (ptr < topLevel.length) {
      if (topLevel[ptr] === h.text) {
        prev = h.text;
        ptr += 1;
        moved = true;
        break;
      }
      ptr += 1;
    }
    if (!moved) {
      fail(`${targetPath}:${h.line} — heading '${h.text}' out of order (expected after '${prev}')`);
    }
  }
}

// 3. Required level-2 missing (top-level uses the legacy un-suffixed shape).
for (const sec of sections) {
  if (sec.level !== 2) continue;
  if (sec.required === false) continue;
  const present = targetTop.some((h) => h.text === sec.heading);
  if (!present) {
    process.stderr.write(`${targetPath}: missing required heading '${sec.heading}'\n`);
    exitCode = 1;
  }
}

// 4. Recursive per-section walk. 6.9.0 — each section validates ONLY its
//    declared sub_sections (parent-scoped allowlist) instead of using a
//    flat global declaredHeadings set. lines_match still applies on the
//    section body. Cohort-1 schemas without sub_sections behave identically:
//    sub_sections=[] + forbid_invented_sub_headings:true means "no child
//    headings expected here" — any L3 under the section is flagged.
function processSection(section, secIdx) {
  const myLevel = section.level;
  const myLine = headings[secIdx].line;

  // Compute byte-line range: section heading line → next sibling-or-higher.
  let endByteLine = lines.length + 1;
  for (let j = secIdx + 1; j < headings.length; j++) {
    if (headings[j].level <= myLevel) {
      endByteLine = headings[j].line;
      break;
    }
  }

  // Direct children = headings inside the section's range with level = myLevel + 1.
  const directChildren = [];
  for (let j = secIdx + 1; j < headings.length; j++) {
    const h = headings[j];
    if (h.level <= myLevel) break;
    if (h.level === myLevel + 1) directChildren.push({ h, idx: j });
  }

  const subs = Array.isArray(section.sub_sections) ? section.sub_sections : [];
  const declared = new Set(subs.map((s) => s.heading));
  const forbid = section.forbid_invented_sub_headings !== false;

  // 6.11.0 — `sub_sections_heading_pattern` (regex source on the parent) is
  // an additional allowlist for direct children. Coexists with fixed
  // `sub_sections[]`: a child is OK if it matches a declared name OR matches
  // the pattern. Pattern-matched children are not subject to required-missing.
  let subPatternRx = null;
  if (section.sub_sections_heading_pattern) {
    try {
      subPatternRx = new RegExp(section.sub_sections_heading_pattern);
    } catch (err) {
      process.stderr.write(
        `schema: invalid sub_sections_heading_pattern regex for '${section.heading}': ${err.message}\n`,
      );
      process.exit(2);
    }
  }

  // 4a. Missing required sub_sections.
  for (const sub of subs) {
    if (sub.required === false) continue;
    const present = directChildren.some((c) => c.h.text === sub.heading);
    if (!present) {
      process.stderr.write(
        `${targetPath}: missing required heading '${sub.heading}' under '${section.heading}'\n`,
      );
      exitCode = 1;
    }
  }

  // 4b. Invented direct children (forbid: true; default).
  if (forbid) {
    for (const c of directChildren) {
      if (declared.has(c.h.text)) continue;
      if (subPatternRx && subPatternRx.test(c.h.text)) continue;
      fail(`${targetPath}:${c.h.line} — invented heading '${c.h.text}' not in schema`);
    }
  }

  // 4c. lines_match — 6.8.0 semantics preserved (only top-level bullets at col 0,
  //     inside fences exempt, continuation prose exempt).
  if (section.lines_match) {
    let rx;
    try {
      rx = new RegExp(section.lines_match);
    } catch (err) {
      process.stderr.write(
        `schema: invalid lines_match regex for '${section.heading}': ${err.message}\n`,
      );
      process.exit(2);
    }
    let inFenceLocal = false;
    for (let j = myLine; j < endByteLine - 1; j++) {
      const ln = lines[j];
      if (ln === undefined) continue;
      if (/^\s*```/.test(ln)) { inFenceLocal = !inFenceLocal; continue; }
      if (inFenceLocal) continue;
      if (ln.trim() === '') continue;
      if (HEADING.test(ln)) continue;
      if (!/^[-*]\s/.test(ln)) continue;
      if (!rx.test(ln)) {
        fail(`${targetPath}:${j + 1} — line does not match expected pattern under '${section.heading}'`);
      }
    }
  }

  // 4d. Recurse into matched sub_sections (declared AND present in the doc).
  for (const sub of subs) {
    if (sub.level !== myLevel + 1) continue;
    const childMatch = directChildren.find((c) => c.h.text === sub.heading);
    if (!childMatch) continue;
    processSection(sub, childMatch.idx);
  }
}

// Process each level-2 section that actually appears in the target.
for (const sec of sections) {
  if (sec.level !== 2) continue;
  const idx = headings.findIndex((h) => h.level === 2 && h.text === sec.heading);
  if (idx < 0) continue;
  processSection(sec, idx);
}

process.exit(exitCode);
