-- 5-6-bridge-connector FIX10 (2026-05-27 post-smoke-test):
-- Drop the brownfield CHECK accounts.cash_balance >= 0.
--
-- Original constraint (baseline migration line 194) was a V0 assumption that
-- every account is a positive-balance vehicle (livret/PEA/CTO/AV). With story
-- 5-6's Bridge integration this no longer holds: credit cards and loans
-- naturally carry NEGATIVE balances (the dette amount). Bridge sandbox
-- "Demo bank" returns e.g. Carte Visa Classic with balance=-1102.07.
--
-- Removing the constraint lets Pekulo store the true bank state. The total-
-- liquide UI computation (apps/web Patrimoine) will now correctly reflect
-- the net (positive accounts + negative card/loan rows). User-recorded
-- accounts via the parametres form can still be expected positive; the API
-- doesn't gate that at the schema level any more — UX-level validation can
-- live in the create-account form if Alex wants the guardrail back.

ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_cash_balance_check";
