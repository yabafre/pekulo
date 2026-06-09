-- CreateTable
CREATE TABLE "dashboard_layout" (
    "user_id" UUID NOT NULL,
    "widgets" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_layout_pkey" PRIMARY KEY ("user_id")
);

-- RLS policies (manually appended — Prisma does not introspect policies, ADR-0013).
-- dashboard_layout is per-user mutable state (one row/user): SELECT/INSERT/UPDATE
-- scoped to the owner. No DELETE policy — a layout reset overwrites via UPDATE;
-- row removal happens only via cascade from auth.users (account deletion, 11-2).
ALTER TABLE "dashboard_layout" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_layout_select_own" ON "dashboard_layout"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "dashboard_layout_insert_own" ON "dashboard_layout"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "dashboard_layout_update_own" ON "dashboard_layout"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
