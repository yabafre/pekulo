-- Story 6-4 (FR-33 / DR-12 / AC-3) — per-user "AI transparency notice seen"
-- timestamp on the existing llm_opt_in row (one row per user). NULL = never
-- shown. No RLS change: a column add on a table whose policy quartet already
-- shipped (story 6-1) — db:rls-audit policy counts stay unchanged.
ALTER TABLE "llm_opt_in" ADD COLUMN IF NOT EXISTS "ai_notice_seen_at" TIMESTAMPTZ;
