// apps/api/src/platform/auth/supabase-admin.ts
// Story 11-2 (FR-50). The ONLY place apps/api touches the Supabase Auth Admin
// API. Identity (email, password hash, sessions, refresh tokens, identities,
// MFA factors) lives in the `auth` schema, not in Prisma's public schema —
// deleting the Postgres rows erases the user's DATA but leaves the ACCOUNT.
//
// Why the Admin API and not `DELETE FROM auth.users`: the raw delete works
// (the FK cascades would even fire), but it bypasses Supabase Auth's own
// bookkeeping, and docs/security.md records the invariant that apps/api runs
// NO raw SQL against user data beyond the `SELECT 1` health probe. One extra
// credential is a smaller price than breaking that invariant.
//
// The factory takes the callable rather than the client so the unit test can
// drive both branches without a key or a network.
import { createClient } from "@supabase/supabase-js";
import { PekuloError } from "../../common/errors";

export interface AuthAdminPort {
  /** Erases the Supabase Auth user. Resolves on success, throws otherwise. */
  deleteUser(userId: string): Promise<void>;
}

export interface AuthAdminError {
  message: string;
  /** HTTP status Supabase answered with, when it answered at all. */
  status?: number;
  /** Supabase Auth error code (e.g. `user_not_found`), when present. */
  code?: string;
}

export interface AuthAdminDeleteFn {
  (userId: string): Promise<{ error: AuthAdminError | null }>;
}

// Per-attempt ceiling on the Admin API round-trip. The service retries once,
// so the identity phase costs at most 2 × this + the retry delay; the sum of
// every phase is asserted under NFR-7's 60 s in settings.deletion-budget.test.ts.
export const AUTH_ADMIN_TIMEOUT_MS = 4_000;

function isAlreadyGone(error: AuthAdminError): boolean {
  return error.status === 404 || error.code === "user_not_found";
}

export function createAuthAdmin(deps: { deleteUser: AuthAdminDeleteFn }): AuthAdminPort {
  return {
    async deleteUser(userId) {
      const { error } = await deps.deleteUser(userId);
      if (!error) return;
      // "No such user" IS the end state this call exists to reach — the same
      // posture as Bridge's deleteUser admitting a 404. Without it, a second
      // confirmation from another tab (JWT still valid, data already gone)
      // would fail the identity step, log a false erase failure and answer
      // 500 for an account that is, in fact, fully erased.
      if (isAlreadyGone(error)) return;
      // No user id in the message: it reaches logs and the error mapper,
      // and the service already writes a hashed id in its structured line.
      throw new PekuloError("INTERNAL", `supabase auth admin deleteUser failed: ${error.message}`);
    },
  };
}

/**
 * Production wiring. `persistSession: false` + `autoRefreshToken: false`
 * because this client is a stateless server-side administrator — it must
 * never try to hold a session of its own. Every request carries an abort
 * timeout: supabase-js has none by default, and an Admin API that hangs
 * would otherwise hold the deletion open past NFR-7's budget.
 */
export function createSupabaseAuthAdmin(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
}): AuthAdminPort {
  const client = createClient(args.supabaseUrl, args.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Cast: Bun's `typeof fetch` also declares `preconnect`, which
      // supabase-js never calls.
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(AUTH_ADMIN_TIMEOUT_MS),
        })) as typeof fetch,
    },
  });
  return createAuthAdmin({
    deleteUser: async (userId) => {
      const { error } = await client.auth.admin.deleteUser(userId);
      return {
        error: error
          ? {
              message: error.message,
              status: typeof error.status === "number" ? error.status : undefined,
              code: typeof error.code === "string" ? error.code : undefined,
            }
          : null,
      };
    },
  });
}
