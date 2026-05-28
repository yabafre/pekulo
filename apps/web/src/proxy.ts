import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildSecurityHeaders } from "@/lib/security/headers";

export async function proxy(request: NextRequest) {
  // Apply edge security headers to EVERY exit path (pass-through + both
  // redirects) so no response escapes unhardened.
  const securityHeaders = buildSecurityHeaders({
    dev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const withSecurity = (res: NextResponse): NextResponse => {
    for (const [name, value] of Object.entries(securityHeaders)) {
      res.headers.set(name, value);
    }
    return res;
  };

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isApi = pathname.startsWith("/api");
  const isStatic = pathname.startsWith("/_next") || pathname.includes(".");

  if (!isStatic) {
    if (!user && !isAuthPage && !isApi && pathname !== "/") {
      return withSecurity(NextResponse.redirect(new URL("/auth/login", request.url)));
    }
    if (user && isAuthPage) {
      return withSecurity(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  return withSecurity(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
