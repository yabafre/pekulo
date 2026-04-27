---
name: aped-context
description: 'Analyzes existing codebase to generate project context for brownfield development. Use when user says "document codebase", "project context", "existing project", "aped context", or invokes /aped-context. Not for new project ideation — use aped-analyze for greenfield.'
allowed-tools: "Read Grep Glob Bash"
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Context — Brownfield Project Analysis

Use on existing codebases to generate project context before running the APED pipeline. Essential for brownfield projects where you're adding features to existing code.

## Setup

1. Read `.aped/config.yaml` — extract config
2. Verify this is a brownfield project (existing code, not greenfield)
3. Read `.aped/aped-context/references/analysis-checklist.md` for the full analysis checklist

## Codebase Analysis

### Phase 1: Structure Discovery

Scan the project root:
- Detect language/framework from config files (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
- Map directory structure (max 3 levels deep)
- Identify entry points, main modules, config files
- Count: files, LOC, languages used

### Phase 2: Architecture Mapping

- Identify architectural pattern (MVC, hexagonal, microservices, monolith, etc.)
- Map data flow: entry point → processing → storage → response
- List external dependencies and integrations (APIs, databases, queues, caches)
- Identify test framework and coverage approach

### Phase 3: Convention Extraction

- Naming conventions (files, functions, variables, classes)
- Code organization patterns (feature-based, layer-based, domain-based)
- Error handling patterns
- Logging approach
- Config management (env vars, config files, secrets)

### Phase 4: Dependency Audit

- List production dependencies with versions
- Flag outdated or deprecated packages
- Identify security advisories (if available)
- Note lock file type (package-lock, yarn.lock, pnpm-lock, etc.)

## Output

Write project context to `docs/project-context.md`:

```markdown
# Project Context: {project_name}

## Tech Stack
- Language: {lang} {version}
- Framework: {framework} {version}
- Database: {db}
- Test Framework: {test_framework}

## Architecture
- Pattern: {pattern}
- Entry Point: {entry}
- Key Modules: {modules}

## Conventions
- File naming: {convention}
- Code style: {style}
- Error handling: {pattern}

## Dependencies
| Package | Version | Purpose |
|---------|---------|---------|

## Integration Points
- {service}: {purpose}

## Notes for Development
- {important context for new feature development}
```

## State Update

Update `docs/state.yaml`:
```yaml
project_context:
  generated: true
  path: "docs/project-context.md"
  type: "brownfield"
```

## Next Steps

Suggest:
- If no brief exists: run `/aped-analyze` with project context loaded
- If brief exists: context will inform `/aped-prd` and `/aped-dev` decisions

## Example

Scanning a Next.js SaaS project → project-context.md:
- Stack: TypeScript, Next.js 14, Prisma, PostgreSQL
- Pattern: App Router, server components, feature-based folders
- Conventions: camelCase files, Zod validation, Tailwind CSS
- 45 dependencies, 3 outdated, 0 security advisories

## Common Issues

- **No package.json/Cargo.toml found**: Project may be multi-language or unconventional — scan for entry points manually
- **Very large codebase (>1000 files)**: Focus on src/ and key config files, don't scan node_modules or build output
- **Monorepo detected**: Document each package/app separately in the context file
