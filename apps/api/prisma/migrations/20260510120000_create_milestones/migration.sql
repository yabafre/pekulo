-- CreateEnum
CREATE TYPE "milestone_status" AS ENUM ('ahead', 'on_track', 'behind');

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "target_capital" DECIMAL NOT NULL,
    "target_year" SMALLINT NOT NULL,
    "label" VARCHAR(120),
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_user_id_target_year_idx" ON "milestones"("user_id", "target_year" ASC);

-- RLS policies (manually appended — Prisma does not introspect policies).
-- milestones is a regular CRUD table — full quartet (SELECT / INSERT / UPDATE / DELETE).
-- AC-12 of story 1-2: db:rls-audit asserts exactly 4 policies on this table.
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own milestones" ON "milestones"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own milestones" ON "milestones"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own milestones" ON "milestones"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own milestones" ON "milestones"
  FOR DELETE USING (auth.uid() = user_id);
