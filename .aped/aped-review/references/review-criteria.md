# Adversarial Review Criteria

## Severity Definitions

| Severity | Definition | Action |
|----------|-----------|--------|
| **CRITICAL** | Task marked done with no code evidence, security vulnerability, data loss risk | Must fix immediately |
| **HIGH** | AC not implemented, files in story but no changes, broken functionality | Must fix before done |
| **MEDIUM** | Files changed but not in story list, code quality issues, missing error handling | Fix or document |
| **LOW** | Minor improvements, style inconsistencies, optional optimizations | Note for future |

## Review Protocols

### 1. AC Validation Protocol

For EACH acceptance criteria in the story:

1. Read the AC (Given/When/Then)
2. Search codebase for implementation evidence
3. Find the specific file:line that satisfies each part:
   - **Given**: setup/precondition code
   - **When**: trigger/action code
   - **Then**: outcome/assertion code
4. Rate:
   - **IMPLEMENTED**: clear code evidence for all three parts
   - **PARTIAL**: some parts implemented, others missing
   - **MISSING**: no code evidence found

### 2. Task Audit Protocol

For EACH task marked `[x]` in the story:

1. Read the task description
2. Search for code that fulfills the task
3. Verify tests exist for the task
4. Check:
   - Task done + code exists + tests pass = OK
   - Task done + code exists + no tests = MEDIUM
   - Task done + no code evidence = **CRITICAL**

### 3. Code Quality Checklist

#### Security
- [ ] All user inputs validated and sanitized
- [ ] No SQL injection vectors (parameterized queries)
- [ ] No command injection (no `eval`, no unescaped shell commands)
- [ ] No XSS vectors (output encoding)
- [ ] Authentication on protected routes
- [ ] Authorization checks (user can only access own data)
- [ ] No hardcoded secrets or API keys
- [ ] HTTPS enforced for sensitive data

#### Performance
- [ ] No N+1 query patterns
- [ ] Appropriate database indexes
- [ ] No unnecessary data fetching (select only needed fields)
- [ ] Caching where appropriate
- [ ] No blocking operations in hot paths
- [ ] Pagination for list endpoints

#### Reliability
- [ ] Error handling on all external calls (DB, API, filesystem)
- [ ] Graceful degradation on failure
- [ ] No swallowed exceptions (catch without logging/handling)
- [ ] Null/undefined checks on external data
- [ ] Timeout handling on network requests
- [ ] Retry logic where appropriate

#### Test Quality
- [ ] Real assertions (not `expect(true).toBe(true)`)
- [ ] Edge cases tested (empty, null, boundary values)
- [ ] Error paths tested (not just happy path)
- [ ] Tests are independent (no shared mutable state)
- [ ] Test descriptions match what they test
- [ ] No hardcoded test data that masks bugs

## Minimum Findings Floor

**3 findings minimum.** If after thorough review you have fewer than 3:

Re-examine these areas:
1. **Edge cases**: What happens with empty inputs? Maximum values? Concurrent access?
2. **Architecture violations**: Does the code follow the patterns established in project-context?
3. **Test gaps**: Are there untested code paths? Missing error scenario tests?
4. **Error handling**: What happens when external services fail? Network timeout? Invalid data?
5. **Security surface**: Any input that reaches the database without validation?

## Fix vs Defer Decision

### Fix Immediately (this review cycle)
- CRITICAL findings — always
- HIGH findings where fix is straightforward (< 30 min)
- Security vulnerabilities

### Defer to Dev (add [AI-Review] items)
- HIGH findings requiring significant refactoring
- Findings that need user input or architectural decisions
- Issues that might break other stories if fixed now

### Format for Deferred Items
```
[AI-Review][HIGH] Missing input validation on email field [src/auth/register.ts:42]
[AI-Review][CRITICAL] Task 3 marked done but no test exists [src/api/users.test.ts]
```
