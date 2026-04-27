#!/usr/bin/env node
// APED statusline. Installed via `aped-method statusline`. Reads the APED
// state.yaml and git branch to render a compact phase / epic / story /
// review / worktrees / branch line. Best-effort YAML parsing via regex;
// degrades silently when state is missing or malformed.
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data = {};
  try { data = input ? JSON.parse(input) : {}; } catch { data = {}; }

  const projectDir = process.env.CLAUDE_PROJECT_DIR
    || data.workspace?.project_dir
    || data.workspace?.current_dir
    || process.cwd();

  const statePath = join(projectDir, 'docs', 'state.yaml');
  const summary = summarizeState(statePath);
  const branch = readBranch(projectDir);
  const worktrees = countWorktrees(projectDir, summary);
  const model = data.model?.display_name || data.model?.id || 'Claude';
  const project = basename(projectDir);
  const ctx = contextBar(data);

  // Color scheme (no reuse on the same line, semantics-driven):
  //   red           model      (identity, primary)
  //   white         ctx        (neutral data / progress bar)
  //   bright blue   project    (location context)
  //   yellow        phase      (workflow progress)
  //   magenta       epic       (grouping)
  //   cyan          story      (active focus)
  //   bright yellow review     (queue / attention — not an error, so not red)
  //   bright magenta worktrees (parallel / branching work)
  //   green/bright red git     (clean / dirty)
  const parts = [
    color('31', model),
    ctx ? color('37', 'ctx:' + ctx) : null,
    color('94', project),
    summary.phase ? color('33', 'phase:' + summary.phase) : null,
    summary.epic ? color('35', 'epic:' + summary.epic) : null,
    summary.story ? color('36', 'story:' + summary.story) : null,
    summary.reviewCount > 0 ? color('93', 'review:' + summary.reviewCount) : null,
    worktrees > 0 ? color('95', 'worktrees:' + worktrees) : null,
    branch ? color(summary.dirty ? '91' : '32', 'git:' + branch + (summary.dirty ? '*' : '')) : null,
  ].filter(Boolean);

  process.stdout.write(parts.join(' | ') + '\n');
});

// Context usage bar. Reads the last assistant turn's usage from the transcript
// (input + cache_read + cache_creation = total context used that turn) and
// renders `[█████░░░░░] 235k/1M (23%)`. Silent on any failure — it's advisory.
function contextBar(data) {
  const transcriptPath = data?.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return null;

  let used = 0;
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const raw = lines[i].trim();
      if (!raw) continue;
      let entry;
      try { entry = JSON.parse(raw); } catch { continue; }
      const usage = entry?.message?.usage;
      if (!usage) continue;
      used = (usage.input_tokens || 0)
        + (usage.cache_read_input_tokens || 0)
        + (usage.cache_creation_input_tokens || 0);
      break;
    }
  } catch { return null; }

  if (used <= 0) return null;

  const limit = detectContextWindow(data);
  const pct = Math.min(used / limit, 1);
  const width = 10;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return '[' + bar + '] ' + formatTokens(used) + '/' + formatTokens(limit) + ' (' + Math.round(pct * 100) + '%)';
}

function detectContextWindow(data) {
  const id = (data?.model?.id || '').toLowerCase();
  const name = (data?.model?.display_name || '').toLowerCase();
  if (id.includes('[1m]') || name.includes('1m context') || name.includes('1m ')) return 1_000_000;
  return 200_000;
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'k';
  return String(n);
}

function summarizeState(statePath) {
  if (!existsSync(statePath)) {
    return { phase: 'none', epic: null, story: null, reviewCount: 0, worktreeCount: 0, dirty: false };
  }

  const state = readFileSync(statePath, 'utf8');
  const phaseMatch = state.match(/current_phase:\s*"?([^"\n]+)"?/);
  const epicMatch = state.match(/active_epic:\s*([^\n]+)/);
  const stories = [];
  let currentStory = null;

  for (const line of state.split('\n')) {
    const storyMatch = line.match(/^\s{2}([^:\s]+):\s*$/);
    if (storyMatch) {
      currentStory = { key: storyMatch[1] };
      stories.push(currentStory);
      continue;
    }
    const statusMatch = line.match(/^\s{4}status:\s*"?([^"\n]+)"?/);
    if (statusMatch && currentStory) currentStory.status = statusMatch[1];
    const worktreeMatch = line.match(/^\s{4}worktree:\s*"?([^"\n]+)"?/);
    if (worktreeMatch && currentStory) currentStory.worktree = worktreeMatch[1];
  }

  const activeStory = stories.find((story) => ['in-progress', 'review', 'review-queued', 'ready-for-dev'].includes(story.status))
    || null;
  const reviewCount = stories.filter((story) => ['review', 'review-queued'].includes(story.status)).length;
  const worktreeCount = stories.filter((story) => Boolean(story.worktree)).length;

  return {
    phase: phaseMatch ? phaseMatch[1] : 'none',
    epic: epicMatch ? epicMatch[1].replace(/["'\s]/g, '') : null,
    story: activeStory ? activeStory.key : null,
    reviewCount,
    worktreeCount,
    dirty: false,
  };
}

function readBranch(projectDir) {
  const result = spawnSync('git', ['branch', '--show-current'], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function countWorktrees(projectDir, summary) {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status === 0) {
    const count = result.stdout.split('\n').filter((line) => line.startsWith('worktree ')).length;
    return Math.max(count - 1, 0);
  }
  return summary.worktreeCount;
}

function color(code, text) {
  return '\x1b[' + code + 'm' + text + '\x1b[0m';
}
