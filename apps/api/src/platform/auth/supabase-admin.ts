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

export interface AuthAdminDeleteFn {
  (userId: string): Promise<{ error: { message: string } | null }>;
}

export function createAuthAdmin(deps: { deleteUser: AuthAdminDeleteFn }): AuthAdminPort {
  return {
    async deleteUser(userId) {
      const { error } = await deps.deleteUser(userId);
      if (error) {
        // No user id in the message: it reaches logs and the error mapper,
        // and the service already writes the id once in its structured line.
        throw new PekuloError(
          "INTERNAL",
          `supabase auth admin deleteUser failed: ${error.message}`,
        );
      }
    },
  };
}

/**
 * Production wiring. `persistSession: false` + `autoRefreshToken: false`
 * because this client is a stateless server-side administrator — it must
 * never try to hold a session of its own.
 */
export function createSupabaseAuthAdmin(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
}): AuthAdminPort {
  const client = createClient(args.supabaseUrl, args.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return createAuthAdmin({
    deleteUser: async (userId) => {
      const { error } = await client.auth.admin.deleteUser(userId);
      return { error: error ? { message: error.message } : null };
    },
  });
}
