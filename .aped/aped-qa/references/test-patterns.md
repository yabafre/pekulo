# E2E & Integration Test Patterns

## Framework Selection

| Project Type | E2E Framework | Integration Framework |
|-------------|---------------|----------------------|
| Node.js + React | Playwright or Cypress | Supertest + Vitest |
| Node.js + API only | - | Supertest + Jest/Vitest |
| Next.js | Playwright | Next.js test utils |
| Python + Django/Flask | Playwright | pytest + httpx |
| Python + FastAPI | Playwright | pytest + httpx |
| Go | - | go test + httptest |
| Rust | - | reqwest + tokio::test |

## E2E Test Structure

```
tests/e2e/
  {journey-name}.test.{ext}     # One file per user journey
  fixtures/                      # Test data
  helpers/                       # Page objects, utilities
```

### User Journey Test Template

```
describe("{Journey Name}", () => {
  test("happy path: {description}", async () => {
    // Given: {precondition from AC}
    // When: {action from AC}
    // Then: {outcome from AC}
  });

  test("error: {error scenario}", async () => {
    // Given: {invalid state}
    // When: {action}
    // Then: {error handling}
  });

  test("edge: {edge case}", async () => {
    // Given: {boundary condition}
    // When: {action}
    // Then: {expected behavior}
  });
});
```

## Integration Test Structure

```
tests/integration/
  {endpoint-or-service}.test.{ext}
  fixtures/
  helpers/
```

### API Test Template

```
describe("{Endpoint/Service}", () => {
  test("POST /api/resource - creates resource", async () => {
    // Arrange: valid payload
    // Act: POST request
    // Assert: 201, response body, DB state
  });

  test("POST /api/resource - 400 on invalid input", async () => {
    // Arrange: invalid payload
    // Act: POST request
    // Assert: 400, error message
  });

  test("GET /api/resource/:id - 404 on missing", async () => {
    // Arrange: non-existent ID
    // Act: GET request
    // Assert: 404
  });

  test("auth: rejects unauthenticated requests", async () => {
    // Arrange: no auth header
    // Act: request
    // Assert: 401
  });
});
```

## Test Coverage Goals

| Category | Target | How to verify |
|----------|--------|---------------|
| AC coverage | 100% of ACs have tests | Map each AC → test |
| Happy paths | Every user journey | 1 E2E test per journey |
| Error paths | All error states | 1 test per error scenario |
| Auth boundaries | All protected routes | Unauthorized + forbidden |
| Edge cases | Empty, null, max values | Boundary value analysis |

## Anti-Patterns

- **Flaky tests**: Don't depend on timing. Use waitFor, retries, explicit waits.
- **Shared state**: Each test must be independent. Reset DB/state before each.
- **Hardcoded selectors**: Use data-testid or accessible roles, not CSS classes.
- **Testing implementation**: Test behavior, not internal structure.
- **No assertions**: Every test must assert something. `expect(true).toBe(true)` is not a test.
