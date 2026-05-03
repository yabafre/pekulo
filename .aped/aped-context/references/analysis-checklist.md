# Brownfield Project Analysis Checklist

## Phase 1: Structure Discovery

- [ ] Identify primary language(s) from config files
- [ ] Map directory structure (max 3 levels)
- [ ] Find entry points (main, index, app, server)
- [ ] Count: files, LOC, languages
- [ ] Identify package manager (npm, yarn, pnpm, cargo, pip, go mod)
- [ ] Check for monorepo structure (workspaces, packages/)

## Phase 2: Architecture Mapping

- [ ] Identify pattern (MVC, hexagonal, microservices, monolith, serverless)
- [ ] Map data flow: entry → processing → storage → response
- [ ] List databases and data stores
- [ ] List external API integrations
- [ ] List message queues/event systems
- [ ] Identify caching layer
- [ ] Map authentication/authorization flow

## Phase 3: Convention Extraction

- [ ] File naming convention (camelCase, kebab-case, PascalCase)
- [ ] Function/method naming convention
- [ ] Code organization (feature-based, layer-based, domain-based)
- [ ] Error handling pattern (try/catch, Result type, error codes)
- [ ] Logging approach (structured, unstructured, library used)
- [ ] Config management (env vars, .env files, config files, vault)
- [ ] Linting/formatting (ESLint, Prettier, Biome, rustfmt)

## Phase 4: Dependency Audit

- [ ] List production dependencies with versions
- [ ] Flag outdated packages (major versions behind)
- [ ] Check for known security advisories
- [ ] Identify lock file type
- [ ] Note any vendored/bundled dependencies
- [ ] Check for deprecated packages

## Phase 5: Testing

- [ ] Identify test framework(s)
- [ ] Estimate test coverage (file count, coverage reports)
- [ ] Check for CI/CD pipeline config
- [ ] Identify test types present (unit, integration, E2E)
- [ ] Check for test fixtures/factories/mocks

## Output Format

```markdown
# Project Context: {name}

## Tech Stack
- Language: {lang} {version}
- Framework: {framework} {version}
- Database: {db}
- Test Framework: {test_fw}

## Architecture
- Pattern: {pattern}
- Entry: {entry_point}
- Modules: {key_modules}

## Conventions
- Files: {naming}
- Code style: {linter}
- Error handling: {pattern}

## Dependencies ({count} total)
| Package | Version | Purpose | Status |
|---------|---------|---------|--------|

## Integration Points
| Service | Purpose | Protocol |
|---------|---------|----------|

## Notes
- {important_context_for_dev}
```
