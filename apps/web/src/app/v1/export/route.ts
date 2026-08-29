// apps/web/src/app/v1/export/route.ts
// Story 11-1 (FR-49). Authenticated same-origin proxy for the GDPR export.
// Mirrors the shape of v1/logos/route.ts (forward to apps/api, stream the
// body back) with the opposite auth posture: /v1/logos is deliberately
// PUBLIC and bypassed in proxy.ts; /v1/export is deliberately NOT — it must
// stay out of that bypass list forever.
//
// 🔒 The route path carries NO dot. proxy.ts treats any path containing "."
// as a static asset and skips the session check — a filename in the URL would
// make this endpoint unauthenticated. The filename is set here, in the
// Content-Disposition header.
import { NextResponse } from "next/server";
import { ensureRequestContext } from "@/lib/orpc/request-context";

const EXPORT_TIMEOUT_MS = 60_000; // NFR-6 budget.

export async function GET() {
  let accessToken: string;
  try {
    ({ accessToken } = await ensureRequestContext());
  } catch {
    // No session — never touch apps/api (AC-6).
    return new NextResponse("unauthorized", { status: 401 });
  }

  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return new NextResponse("export unavailable", { status: 503 });

  const upstream = `${apiBase.replace(/\/$/, "")}/v1/export`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    });
  } catch {
    return new NextResponse("export failed", { status: 504 });
  }

  if (!res.ok || !res.body) {
    return new NextResponse("export failed", { status: res.status === 401 ? 401 : 502 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pekulo-export-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
