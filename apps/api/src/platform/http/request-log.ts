// apps/api/src/platform/http/request-log.ts
// Structured request-log emitter for the oRPC mount path. One stdout line
// per request, JSON-encoded for log-aggregator ingestion. 0-7 (OTel three
// runtimes) will swap console.log for an OTel span without changing this
// function's signature.

export interface RpcLogEntry {
  requestId: string;
  route: string;
  userId: string;
  durationMs: number;
  status: number;
  // Top-level `errorCode` (flat) — appended only when status >= 400. Flat
  // shape is intentional: log aggregators index single-level fields without
  // dotted-path queries.
  errorCode?: string;
  // Underlying cause class name (low cardinality) for ops debugging — e.g.
  // "JWTExpired", "JWSSignatureVerificationFailed". Only set on failures
  // when the thrown error has a `.cause`. Never set on success paths.
  reasonClass?: string;
}

export function logRpcRequest(entry: RpcLogEntry): void {
  const payload: Record<string, unknown> = {
    event: "rpc.request",
    requestId: entry.requestId,
    route: entry.route,
    userId: entry.userId,
    durationMs: entry.durationMs,
    status: entry.status,
  };
  if (entry.status >= 400 && entry.errorCode) {
    payload.errorCode = entry.errorCode;
  }
  if (entry.status >= 400 && entry.reasonClass) {
    payload.reasonClass = entry.reasonClass;
  }
  console.log(JSON.stringify(payload));
}
