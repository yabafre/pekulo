#!/usr/bin/env node
// APED safe Bash hook. Opt-in via `aped-method safe-bash`. Runs as a
// PreToolUse hook on Bash invocations. Pattern matching is a best-effort
// UX safety net, NOT a security boundary: crafted commands bypass it
// trivially (var-indirection, command substitution, etc). See SECURITY.md.
const rules = [
  { decision: 'deny', label: 'dangerous root delete', pattern: /\brm\s+(-[A-Za-z]*[rRfF][A-Za-z]*\s+)+(\/|\/\s|\/\*|\$HOME|~\/?)/i },
  { decision: 'deny', label: 'curl pipe shell', pattern: /curl\b[^\n|]*\|\s*(bash|sh|zsh)\b/i },
  { decision: 'deny', label: 'wget pipe shell', pattern: /wget\b[^\n|]*\|\s*(bash|sh|zsh)\b/i },
  { decision: 'deny', label: 'disk utility', pattern: /(^|[\s;&|])(dd\s|mkfs(\.[a-z0-9]+)?\s|fdisk\s)/i },
  { decision: 'deny', label: 'broad chmod', pattern: /chmod\s+-R\s+777\b/i },
  { decision: 'ask', label: 'sudo command', pattern: /(^|[\s;&|])sudo\s/i },
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = input ? JSON.parse(input) : {}; } catch { payload = {}; }

  if (payload.tool_name !== 'Bash') process.exit(0);

  const command = payload.tool_input?.command || '';
  if (!command.trim()) process.exit(0);

  for (const rule of rules) {
    if (!rule.pattern.test(command)) continue;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: rule.decision,
        permissionDecisionReason: 'APED safe Bash hook matched ' + rule.label + ': ' + command,
      },
    }) + '\n');
    return;
  }
});
