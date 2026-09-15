// apps/api/src/platform/auth/ — Supabase Auth administration.
// Public surface of the module; consumers import through here, mirroring
// platform/security/index.ts.
export { createAuthAdmin, createSupabaseAuthAdmin } from "./supabase-admin";
export type { AuthAdminPort, AuthAdminDeleteFn } from "./supabase-admin";
