-- CreateTable
CREATE TABLE "compass_history" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "objectif" DECIMAL NOT NULL,
    "horizon_years" SMALLINT NOT NULL,
    "valued_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compass_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compass_history_user_id_valued_on_idx" ON "compass_history"("user_id", "valued_on" DESC);

-- RLS policies (manually appended — Prisma does not introspect policies).
-- compass_history is an audit sister table per ADR-0001:
--   - INSERT and SELECT only (no UPDATE/DELETE policy).
--   - Deletion happens only via cascade from auth.users (user account deletion,
--     story 11-2). The lack of a DELETE policy enforces append-only writes.
ALTER TABLE "compass_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compass history" ON "compass_history"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own compass history" ON "compass_history"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
