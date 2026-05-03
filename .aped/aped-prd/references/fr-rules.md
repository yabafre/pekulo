# Functional Requirements Quality Rules

## FR Format

Every FR MUST follow this format:
```
FR#: [Actor] can [capability] [context/constraint]
```

### Examples
- `FR1: User can create an account using email and password`
- `FR12: Admin can export user data as CSV filtered by date range`
- `FR25: System can process payment transactions within 3 seconds`

### Actors
Use specific actors, not generic ones:
- **Good**: User, Admin, Manager, System, API Consumer
- **Bad**: Someone, People, Anyone, They

## Anti-Patterns (MUST NOT appear in FRs)

### Subjective Adjectives
These words are unmeasurable and untestable:
- ~~easy~~ — specify the number of steps or clicks
- ~~intuitive~~ — specify the interaction pattern
- ~~fast~~ — specify the time threshold (e.g., "within 2 seconds")
- ~~responsive~~ — specify the breakpoints or time limits
- ~~simple~~ — specify the complexity constraints

### Vague Quantifiers
These words hide undefined scope:
- ~~multiple~~ — specify the exact number or range (e.g., "up to 10")
- ~~several~~ — specify the count
- ~~various~~ — list the specific items

### Implementation Leakage
FRs describe WHAT, not HOW:
- **Bad**: `FR5: User can login using React form with JWT tokens`
- **Good**: `FR5: User can authenticate with email and password`
- No technology names (React, PostgreSQL, Redis)
- No implementation details (JWT, REST, WebSocket)
- No specific libraries or frameworks

## NFR Format

```
The system shall [metric] [condition] [measurement method]
```

### Examples
- `The system shall respond to API requests within 200ms at the 95th percentile under normal load`
- `The system shall support 10,000 concurrent users without degradation`
- `The system shall achieve WCAG 2.1 AA compliance on all public pages`

### NFR Categories (include only when relevant)
- **Performance**: response times, throughput, resource usage
- **Security**: authentication, authorization, encryption, compliance
- **Scalability**: concurrent users, data volume, geographic distribution
- **Accessibility**: WCAG level, assistive technology support
- **Integration**: API compatibility, data format standards, protocol support

## Information Density Rules

- Every sentence carries weight — zero fluff
- No preambles ("In order to provide...", "The system should aim to...")
- No redundant context (if it's in the Product Scope, don't repeat in FRs)
- One FR = one capability (no compound FRs with "and" joining unrelated actions)
