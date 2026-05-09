-- aped-review F5 (story 1-3): the wealth provider closure in
-- runtime-dependencies.ts queries monthly_tracking with
--   where: { userId } orderBy: [year asc, monthNum asc]
-- The existing unique index (userId, monthNum, year) does NOT cover that
-- sort order — Postgres falls back to a sort step. This index aligns the
-- column order with the curve query so the planner uses index scan + no
-- sort. Brownfield table — no schema change beyond the new index.

-- CreateIndex
CREATE INDEX "monthly_tracking_user_id_year_month_num_idx" ON "monthly_tracking"("user_id", "year" ASC, "month_num" ASC);
