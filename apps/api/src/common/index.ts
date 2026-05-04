// Placeholder for apps/api/src/common/. Pure utilities (no I/O) land here:
//
//   - errors/               PekuloError base + factories (story 0-5: surfaced via
//                            error-mapper alongside oRPC contracts).
//   - time/                 Clock interface + FakeClock (story 0-5: needed by
//                            services that timestamp domain events).
//   - security-primitives/  constant-time compare + mask-email (story 0-5+ as
//                            modules introduce identifier surfaces).
//   - ids/                  random base62 (Trafi 21-char) + UUID v7 request-id
//                            (story 0-4 wires base62 into the prefixed-ids
//                            extension ; request-id wires into platform/http
//                            in story 0-5).
//
// See docs/architecture.md L822-834 for the canonical layout.
export {};
