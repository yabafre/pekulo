// Placeholder for apps/api/src/platform/. Cross-cutting infra modules land here:
//
//   - http/                → request-id, error-mapper, cors, bearer, rate-limit
//                             (story 0-5: oRPC contracts scaffold introduces error-mapper +
//                              request-id ; story 0-6: zapaction bridge introduces bearer
//                              auth ; rate-limit pinned to (b) public ramp.)
//   - security/            → jwt-verifier, requireUserContext, opt-in-guard
//                             (story 0-6: jwt-verifier + requireUserContext ;
//                              story 6-3: opt-in-guard for 3rd-party LLM path.)
//   - logging/             → otel-logger wrapper (story 0-7).
//   - audit/               → masked-userId helpers (story 0-5+).
//   - observability/       → @opentelemetry/sdk-node init (story 0-7).
//
// See ADR-0009 + docs/architecture.md L786-796 for the canonical layout.
export {};
