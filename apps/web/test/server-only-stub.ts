// apps/web/test/server-only-stub.ts
// Next.js's "server-only" package throws at import time when bundled for the
// client. In vitest (happy-dom) we never round-trip through the bundler's
// server/client split — a no-op export keeps the import resolvable.
export {};
