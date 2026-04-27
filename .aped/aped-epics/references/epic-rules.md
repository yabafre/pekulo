# Epic & Story Design Rules

## Epic Design Principles

### 1. User Value First
Each epic delivers COMPLETE functionality for its domain. Epics are organized by what users can DO, not by technical layers.

**Correct patterns:**
- "User Authentication and Profiles" — complete auth system end-to-end
- "Content Management" — full CRUD for content with publishing
- "Payment Processing" — billing, subscriptions, invoicing

**Wrong patterns:**
- "Database Setup" — no user value, technical layer
- "API Development" — no user value, technical layer
- "Frontend Components" — no user value, technical layer
- "Infrastructure" — exception: acceptable as Epic 1 if project needs scaffolding

### 2. Independence
- Each epic stands alone — no forward dependencies between epics
- Epic N should NOT require Epic N+1 to be useful
- If epics are interdependent, merge them or restructure

### 3. User-Outcome Naming
Epic names describe outcomes:
- "Users can manage their accounts" not "Account Module"
- "Team collaboration and sharing" not "Sharing Feature"

## Story Design Rules

### Format
```
As a [role], I want [capability], so that [benefit].
```

### Acceptance Criteria
Use Given/When/Then format:
```
Given [context/precondition],
When [action/trigger],
Then [expected outcome].
```

Minimum 1 AC per story. Each AC must be independently testable.

### Sizing
- Each story completable in **1 dev session** (single agent invocation)
- If a story has more than 8 tasks, split it
- If a story touches more than 5 files, consider splitting

### Dependency Rules
- No forward dependencies between stories within an epic
- Stories should be implementable in listed order but not REQUIRE that order
- Exception: Epic 1 Story 1 (setup) must come first if it scaffolds the project

### Database Rule
- DB tables/schemas created ONLY when the story that needs them is implemented
- Do NOT create all tables upfront in a "database story"
- Each story creates its own tables as part of implementation

### Starter Template Rule
If the project needs initial scaffolding:
- Epic 1, Story 1 = "Project Setup"
- Covers: project init, dependency install, config files, basic structure
- All subsequent stories build on this foundation

## Validation Gates

### Gate 1: FR Coverage
- Every FR from PRD mapped to exactly one epic
- No orphan FRs, no phantom FRs

### Gate 2: Architecture Compliance
- Stories respect project architecture (from project-context or PRD)
- No stories that violate stated technical decisions

### Gate 3: Story Quality
- Every story has: user story format, ACs in Given/When/Then, tasks with checkboxes
- No story exceeds single-session size

### Gate 4: Epic Structure
- Epics organized by user value
- No technical-layer epics (except setup)
- No forward dependencies
