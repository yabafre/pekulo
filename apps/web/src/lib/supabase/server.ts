import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr's DEFAULT_COOKIE_OPTIONS ships httpOnly:false, so the
      // session would be JS-readable. Force httpOnly so an injected script can
      // neither read nor exfiltrate it (story 11-7, AC-1). The server reads
      // cookies regardless of the flag; the browser client no longer needs them.
      cookieOptions: { httpOnly: true },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Can be ignored in Server Components
          }
        },
      },
    },
  );
}
