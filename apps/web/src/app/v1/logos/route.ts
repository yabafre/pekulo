import { type NextRequest, NextResponse } from "next/server";

// Story 6-10 (FR-65) — same-origin proxy for transaction logo bytes. The
// transaction DTO carries an opaque `/v1/logos?ref=` URL so the browser only
// ever talks to THIS origin (privacy: no merchant CDN / Bridge contact from the
// client, and the proxy URL is relative). This handler forwards to apps/api's
// streaming proxy, which does the SSRF-safe ref → cache → upstream resolution
// (the ref is an opaque cache index, never a caller-supplied address). Public —
// no auth (see the matching bypass in proxy.ts): the ref carries no user data.

const PROXY_TIMEOUT_MS = 6_000;

export async function GET(request: NextRequest) {
  const apiBase = process.env.API_BASE_URL;
  const ref = request.nextUrl.searchParams.get("ref");
  if (!apiBase || !ref) return new NextResponse("logo not found", { status: 404 });

  const upstream = `${apiBase.replace(/\/$/, "")}/v1/logos?ref=${encodeURIComponent(ref)}`;
  try {
    const res = await fetch(upstream, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
    if (!res.ok || !res.body) return new NextResponse("logo not found", { status: 404 });
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") ?? "image/png",
        // Reference data — long, immutable cache. The ref already pins the asset.
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("logo not found", { status: 404 });
  }
}
