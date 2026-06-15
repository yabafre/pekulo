import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_MARKER_COOKIE } from "../recovery-marker";
import { sanitizeNext } from "./safe-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      if (next === "/recover") {
        // Mark that this session reached /recover via a *verified* recovery
        // code exchange — the only server-side signal that tells a recovery
        // session apart from a normal one (auth-js `amr` carries no "recovery"
        // method). The /recover page trusts this httpOnly marker to show the
        // set-new-password form; a normal authenticated user lacks it and is
        // bounced to /dashboard (aped-review M1).
        response.cookies.set(RECOVERY_MARKER_COOKIE, "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth-code-error`);
}
