#!/usr/bin/env node
// APED post-edit TypeScript quality hook. Opt-in via
// `aped-method post-edit-typescript`. Runs prettier --write and eslint --fix
// on .ts/.tsx/.mts/.cts files inside the project only, and only when those
// binaries are already resolvable locally — never installs, never blocks.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Advisory contract: never crash, never block on internal failure. Any
// uncaught error in the hook itself exits 0 silently so the user's edit
// is not affected by hook bugs.
process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = input ? JSON.parse(input) : {}; } catch { payload = {}; }

  const toolName = payload.tool_name || '';
  if (!/^(Write|Edit|MultiEdit)$/.test(toolName)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const filePath = payload.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const absolutePath = filePath.startsWith('/') ? filePath : resolve(projectDir, filePath);
  if (!/\.(ts|tsx|mts|cts)$/.test(absolutePath)) process.exit(0);
  if (!existsSync(absolutePath) || absolutePath.includes('/node_modules/')) process.exit(0);

  // Resolve symlinks before the sandbox check — string-prefix on raw paths
  // misses macOS /var → /private/var and any symlink in projectDir pointing
  // outside the project.
  let realFile;
  let realProject;
  try {
    realFile = realpathSync(absolutePath);
    realProject = realpathSync(projectDir);
  } catch { process.exit(0); }
  if (!realFile.startsWith(realProject + '/')) process.exit(0);

  const actions = [];
  const prettier = resolveBin(projectDir, 'prettier');
  const eslint = resolveBin(projectDir, 'eslint');

  if (prettier) {
    const result = spawnSync(prettier, ['--write', absolutePath], {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) actions.push('prettier --write');
  }

  if (eslint) {
    const result = spawnSync(eslint, ['--fix', absolutePath], {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) actions.push('eslint --fix');
  }

  if (actions.length === 0) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: 'APED TypeScript quality hook ran on ' + absolutePath + ': ' + actions.join(', '),
    },
  }) + '\n');
});

function resolveBin(projectDir, name) {
  const local = join(projectDir, 'node_modules', '.bin', name);
  if (existsSync(local)) return local;

  const packageJsonPath = join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    return allDeps[name] ? local : null;
  } catch {
    return null;
  }
}
