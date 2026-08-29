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

// NFR-6 / AC-1 budget the moment the download STARTS — time-to-first-byte —
// not the whole transfer. Corrected in aped-review of 11-1: the original
// `AbortSignal.timeout(60_000)` passed to fetch also aborts the body stream, so
// any export still transferring at T+60 s was cut mid-file. That is precisely
// the large-volume case the chunked design exists to serve (AC-8), and the
// caller was left with a truncated document under a 200. The clock is now
// stopped as soon as apps/api answers with its headers.
const EXPORT_TTFB_TIMEOUT_MS = 60_000;

// The user-facing stamp follows the app's locale, not UTC: an export started at
// 00:30 Paris time was previously filed under the previous day.
//
// Built lazily, never at module scope. Next runs every route module during
// "Collecting page data", and constructing an ICU-backed Intl formatter there
// crashed the Bun 1.3.14 baseline build on Vercel with a SIGILL segfault —
// compilation succeeded, page-data collection did not. A route module must
// stay cheap to import; the formatter is only needed once a request arrives.
let filenameDate: Intl.DateTimeFormat | undefined;
function stampFor(now: Date): string {
  filenameDate ??= new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" });
  return filenameDate.format(now);
}

export async function GET() {
  let accessToken: string;
  try {
    ({ accessToken } = await ensureRequestContext());
  } catch {
    // No session — never touch apps/api (AC-6). proxy.ts already answers 401
    // for this exact path before the handler runs; this is defence in depth for
    // a session that exists but no longer resolves.
    return new NextResponse("unauthorized", { status: 401 });
  }

  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return new NextResponse("export unavailable", { status: 503 });

  const upstream = `${apiBase.replace(/\/$/, "")}/v1/export`;
  const ttfb = new AbortController();
  const timer = setTimeout(() => ttfb.abort(), EXPORT_TTFB_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: ttfb.signal,
    });
  } catch {
    return new NextResponse("export failed", { status: 504 });
  } finally {
    // Headers are in (or the attempt failed): release the abort so a multi-
    // minute body transfer is never cut by the start-up budget.
    clearTimeout(timer);
  }

  if (!res.ok || !res.body) {
    return new NextResponse("export failed", { status: res.status === 401 ? 401 : 502 });
  }

  const stamp = stampFor(new Date());
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pekulo-export-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
