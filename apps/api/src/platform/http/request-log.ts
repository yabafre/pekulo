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
  errorCode?: string;
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
  console.log(JSON.stringify(payload));
}
