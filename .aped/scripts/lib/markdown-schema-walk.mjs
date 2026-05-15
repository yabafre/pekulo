#!/usr/bin/env node
// markdown-schema-walk — APED structural validator for markdown artefacts.
// Usage: node markdown-schema-walk.mjs <schema.json> <target.md>
// Exit 0 conformant, 1 drift, 2 schema/target unreadable.
// Failure shapes (stable — pinned by tests):
//   path: missing required heading 'NAME'
//   path:LN — invented top-level heading 'NAME' not in schema
//   path:LN — invented heading 'NAME' not in schema
//   path:LN — heading 'NAME' out of order (expected after 'PREV')
//   path:LN — line does not match expected pattern under 'NAME'
//   schema: REASON         (exit 2)
//   path: file not found   (exit 2)

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
const declaredHeadings = new Set(sections.map((s) => s.heading));

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
if (topLevel.length > 0) {
  for (const h of targetTop) {
    if (!allowedTop.has(h.text)) {
      fail(`${targetPath}:${h.line} — invented top-level heading '${h.text}' not in schema`);
    }
  }

  let ptr = 0;
  let prev = '<start>';
  for (const h of targetTop) {
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

// 3. Required level-2 missing
for (const sec of sections) {
  if (sec.level !== 2) continue;
  if (sec.required === false) continue;
  const present = targetTop.some((h) => h.text === sec.heading);
  if (!present) {
    process.stderr.write(`${targetPath}: missing required heading '${sec.heading}'\n`);
    exitCode = 1;
  }
}

// 4. Per-section: forbid_invented_sub_headings + lines_match
for (const sec of sections) {
  if (sec.level !== 2) continue;
  const idx = headings.findIndex((h) => h.level === 2 && h.text === sec.heading);
  if (idx < 0) continue;
  const startLine = headings[idx].line;
  let endLine = lines.length + 1;
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j].level <= sec.level) {
      endLine = headings[j].line;
      break;
    }
  }

  if (sec.forbid_invented_sub_headings !== false) {
    for (let j = idx + 1; j < headings.length; j++) {
      const sub = headings[j];
      if (sub.line >= endLine) break;
      if (sub.level <= sec.level) break;
      if (!declaredHeadings.has(sub.text)) {
        fail(`${targetPath}:${sub.line} — invented heading '${sub.text}' not in schema`);
      }
    }
  }

  if (sec.lines_match) {
    let rx;
    try {
      rx = new RegExp(sec.lines_match);
    } catch (err) {
      process.stderr.write(`schema: invalid lines_match regex for '${sec.heading}': ${err.message}\n`);
      process.exit(2);
    }
    // 6.8.0 — only validate TOP-LEVEL list-item-starting lines. Continuation
    // prose, fenced code blocks, sub-bullets, blockquotes, tables — all exempt.
    // The schema's lines_match describes what an item header looks like, not
    // every line of body content under it. Pre-6.8.0 the walker validated
    // every non-empty / non-heading line, which produced hundreds of false
    // positives on stories that explained ACs with prose or code examples.
    let inFence = false;
    for (let j = startLine; j < endLine - 1; j++) {
      const ln = lines[j];
      if (ln === undefined) continue;
      if (/^\s*```/.test(ln)) { inFence = !inFence; continue; }
      if (inFence) continue;
      if (ln.trim() === '') continue;
      if (HEADING.test(ln)) continue;
      // Only enforce lines_match on bullets that start at column 0 (top-level
      // list items). Anything indented or prose-shaped is allowed body content.
      if (!/^[-*]\s/.test(ln)) continue;
      if (!rx.test(ln)) {
        fail(`${targetPath}:${j + 1} — line does not match expected pattern under '${sec.heading}'`);
      }
    }
  }
}

process.exit(exitCode);
