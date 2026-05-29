#!/usr/bin/env bash
# APED SessionStart hook (opt-in via `aped-method session-start`).
#
# Two outputs per fire:
#   1. `additionalContext` — the SKILL-INDEX.md content, injected into
#      Claude's context window so the agent sees an APED skill inventory
#      at the start of every session/clear/compact event.
#   2. `systemMessage` — a one-line user-visible banner ("✓ APED v4.X.Y
#      loaded · N skills · tickets: <provider> · git: <provider>") so the
#      user gets a confirmation that the hook actually fired.
#
# Pre-4.12.1 the hook was silent on the user side — only the agent saw
# the SKILL-INDEX. Users couldn't tell whether the hook was firing or
# whether their session-start install was broken. systemMessage closes
# that loop.
#
# Silent on errors: if SKILL-INDEX.md is missing, exit 0 with no output;
# a partial install / pre-scaffold state must NOT crash session start.
#
# Cross-platform note: design mirrors superpowers' polyglot wrapper
# pattern. On Windows, the matching `run-hook.cmd` (if installed) calls
# Git-for-Windows bash to execute this script. On macOS / Linux this
# script runs directly via the shebang.

set -euo pipefail

# Locate the project root. Claude Code sets CLAUDE_PROJECT_DIR for hooks;
# fall back to git toplevel, then to PWD.
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

# Discover the APED dir. Default is .aped (matches DEFAULTS.apedDir) but
# honour .aped substitution at scaffold time so non-default dirs
# also work without re-editing the script.
APED_DIR=".aped"
INDEX_FILE="${PROJECT_ROOT}/${APED_DIR}/skills/SKILL-INDEX.md"
CONFIG_FILE="${PROJECT_ROOT}/${APED_DIR}/config.yaml"

if [[ ! -f "$INDEX_FILE" ]]; then
  # Index not generated (e.g. partial install) — emit nothing, exit clean.
  exit 0
fi

CONTENT=$(cat "$INDEX_FILE" 2>/dev/null || true)

if [[ -z "$CONTENT" ]]; then
  exit 0
fi

# Check if CLAUDE.md has the APED block (5.5.0). Worktrees with gitignored
# CLAUDE.local.md lose the discipline instructions entirely. Warn loudly.
CLAUDE_MD="${PROJECT_ROOT}/CLAUDE.md"
APED_BLOCK_PRESENT=0
if [[ -f "$CLAUDE_MD" ]]; then
  APED_BLOCK_PRESENT=$({ grep 'APED:START' "$CLAUDE_MD" 2>/dev/null || true; } | wc -l | tr -d ' ')
fi
APED_BLOCK_WARNING=""
if [[ "$APED_BLOCK_PRESENT" -eq 0 ]]; then
  APED_BLOCK_WARNING=" ⚠ CLAUDE.md missing APED block — run aped-claude to inject it"
fi

# Build the user-visible banner.
#
# Skill count — from the SKILL-INDEX.md body. The generator emits one
# `- aped-<name> — <description>` line per skill (see
# scripts.js#buildSkillIndex). Count those lines; defensively cap to 999
# in case the index format ever changes shape.
SKILL_COUNT=$({ grep -E '^-[[:space:]]+aped-' "$INDEX_FILE" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [[ "$SKILL_COUNT" -gt 999 ]]; then
  SKILL_COUNT=999
fi

# Tiny YAML reader. Reads `key: value` from config.yaml — values can be
# bare, single-quoted, or double-quoted. Returns empty string when the
# key is absent or the file doesn't exist. Pure bash, no yq dependency
# (yq is hard-required for sync-state.sh / migrate-state.sh elsewhere
# but a missing-yq host should still see a useful banner).
yaml_get() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || { echo ""; return; }
  local raw
  raw=$(grep -E "^${key}:" "$file" 2>/dev/null | head -1 | sed -E "s/^${key}:[[:space:]]*//" || true)
  # Strip surrounding quotes if present.
  raw="${raw#\"}"; raw="${raw%\"}"
  raw="${raw#\'}"; raw="${raw%\'}"
  # Strip trailing comments and whitespace.
  raw=$(printf '%s' "$raw" | sed -E "s/[[:space:]]+#.*$//" | sed -E 's/[[:space:]]+$//')
  echo "$raw"
}

APED_VERSION=$(yaml_get "aped_version" "$CONFIG_FILE")
TICKET_SYSTEM=$(yaml_get "ticket_system" "$CONFIG_FILE")
GIT_PROVIDER=$(yaml_get "git_provider" "$CONFIG_FILE")
COMMUNICATION_LANGUAGE=$(yaml_get "communication_language" "$CONFIG_FILE")

# Communication language directive. config.yaml documents
# communication_language as "all conversation with the user", but the only
# always-on copy lives in the CLAUDE.md APED block — which is easily missing
# (worktrees, un-injected projects). A workflow.md bullet is read once and
# loses salience, so the model reverts to its English default for terse
# progress narration. Injecting the directive here puts it in Claude's context
# every session, independent of the CLAUDE.md block. Skip when the language is
# unset or English (the default — no reminder needed).
LANGUAGE_DIRECTIVE=""
case "$(printf '%s' "$COMMUNICATION_LANGUAGE" | tr '[:upper:]' '[:lower:]')" in
  ''|english|anglais|en|en-us|en-gb) ;;
  *)
    LANGUAGE_DIRECTIVE="**APED — communication language.** Speak ${COMMUNICATION_LANGUAGE} in every message to the user: progress narration, tool preambles, summaries, and questions all included. This overrides your default narration language. (Artefacts follow document_output_language separately.)"
    ;;
esac

# Compose banner. Falls back gracefully when fields are missing.
BANNER="✓ APED"
if [[ -n "$APED_VERSION" ]]; then
  BANNER="${BANNER} v${APED_VERSION}"
fi
BANNER="${BANNER} ready · ${SKILL_COUNT} skills indexed"
if [[ -n "$TICKET_SYSTEM" ]]; then
  BANNER="${BANNER} · tickets: ${TICKET_SYSTEM}"
fi
if [[ -n "$GIT_PROVIDER" ]]; then
  BANNER="${BANNER} · git: ${GIT_PROVIDER}"
fi
if [[ -n "$LANGUAGE_DIRECTIVE" ]]; then
  BANNER="${BANNER} · lang: ${COMMUNICATION_LANGUAGE}"
fi
if [[ -n "$APED_BLOCK_WARNING" ]]; then
  BANNER="${BANNER}${APED_BLOCK_WARNING}"
fi

# Prepend the language directive to the agent-side context so it is the first
# thing Claude reads at session start — ahead of the skill index.
if [[ -n "$LANGUAGE_DIRECTIVE" ]]; then
  CONTENT="${LANGUAGE_DIRECTIVE}"$'\n\n'"${CONTENT}"
fi

# Escape for JSON embedding. Bash parameter substitution is faster than
# a per-character loop and matches the superpowers session-start hook
# implementation.
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

ESCAPED=$(escape_for_json "$CONTENT")
ESCAPED_BANNER=$(escape_for_json "$BANNER")

# Emit Claude Code SessionStart hook envelope. `systemMessage` is shown
# to the user; `hookSpecificOutput.additionalContext` is added to
# Claude's context. Both are documented as user-and-agent-visible
# respectively in the Claude Code hooks spec.
#
# Uses printf rather than heredoc to avoid bash 5.3+ heredoc hangs on
# some hosts (cf. obra/superpowers#571).
printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ESCAPED_BANNER" "$ESCAPED"

exit 0
