// apps/web/src/instrumentation.ts
// Next.js 16 instrumentation hook — invoked once per server runtime instance
// (Node and Edge each call register() in their own runtime).
//
// Per Next.js docs (apps/web/node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md):
//   "NodeSDK is not compatible with edge runtime, so you need to make sure
//    that you are importing them only when process.env.NEXT_RUNTIME === 'nodejs'."
//
// Story 0-7 wires the node-side SDK only — apps/web has no edge-runtime
// routes at V1 (a). If any future story introduces an edge route, it must
// ship a sibling `instrumentation.edge.ts` with @vercel/otel.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
