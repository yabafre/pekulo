-- bank-connection-provider-id (2026-06-10) — store the Bridge institution
-- provider_id on the connection so the reconnect guard can tell a genuine
-- ACTIVE duplicate from a legitimate revoke→reconnect.
--
-- Before this, completeConnection rejected any reconnect whose accounts already
-- existed locally (stable IBAN key). But revoke soft-deletes the connection and
-- KEEPS its accounts, so those orphaned accounts blocked every reconnect of the
-- same bank ("la banque est déjà liée à Pekulo"). The guard now keys on this
-- column: reject only when a NON-revoked connection already serves the same
-- institution.
--
-- Nullable, no backfill: existing rows keep provider_id = NULL (the reconnect
-- guard only consults ACTIVE connections, and new connections populate it at
-- completeConnection). Hand-written per lesson 2026-05-05; idempotent via
-- Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

ALTER TABLE "bank_connections"
    ADD COLUMN "provider_id" TEXT NULL;

COMMIT;
