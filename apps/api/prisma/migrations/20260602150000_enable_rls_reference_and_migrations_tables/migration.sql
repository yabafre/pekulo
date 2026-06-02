-- Enable RLS on public tables flagged by the Supabase database linter
-- (0013_rls_disabled_in_public). These hold NO user data, but they are reachable
-- via the anon PostgREST endpoint, so RLS is enabled with NO policies =
-- deny-all to the anon / authenticated roles. apps/api connects with the
-- Supabase service role (bypasses RLS, architecture.md:140) and Prisma migrate
-- uses the same privileged connection, so reads/writes + future migrations are
-- unaffected.
--
-- merchant_logo_cache / provider_logo_cache: refines ADR-0015 / architecture.md
-- L131 ("no RLS, no-PII") -> "RLS-on, no-policy" for the logo reference caches.
-- They stay in rls-migration-audit's NON_USER_TABLES (deny-all = 0 policies is
-- intentional, not the >= 2 a user-data table needs).
-- _prisma_migrations: Prisma's internal migration-history table (not created by
-- any Pekulo migration); Supabase recommends enabling RLS here as well.

ALTER TABLE "merchant_logo_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_logo_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
