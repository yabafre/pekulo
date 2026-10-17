# Quick Spec: Supabase auth emails — custom SMTP + signup/confirmation flow fixes

**Date:** 2026-10-17
**Author:** Alex
**Type:** fix
**Status:** done

## What

Fix the auth email frictions (send limit reached, confirmation email blocking, login failures, mails in spam) by (a) configuring a custom SMTP provider + FR templates in the Supabase project [dashboard ops], and (b) two web-tier fixes: `signUp` must pass `options.emailRedirectTo` so the confirmation link returns through `<origin>/callback` (today it falls back to the bare Site URL, so a confirmed user is never logged in), and `signIn` must surface Supabase's `email_not_confirmed` as a dedicated French line instead of the generic "Connexion impossible" message.

## Why

The built-in Supabase sender only delivers to addresses in the project's organisation and is capped at 2 emails/hour (Supabase changelog 2024-09-26): any real signup dies with "Email address not authorized", so _proches_ cannot confirm their account or log in — blocking the V1 (a) ramp. Direction chosen by Alex: keep Supabase Auth, wire a custom SMTP (Brevo/Resend) + verified domain + FR templates, and fix the web-tier gaps that make confirmation and unconfirmed-login behave confusingly even once delivery works.

## Acceptance Criteria

- [x] **AC-1** — `signUp` calls `supabase.auth.signUp` with `options.emailRedirectTo = <origin>/callback`, so a confirmed signup lands back through the callback's code exchange (session established, redirect to `/dashboard`) instead of the bare Site URL. — impl `auth-actions.ts:56` · test `auth-actions.test.ts:116`.
- [x] **AC-2** — `signIn` maps Supabase `email_not_confirmed` (code or message) to a dedicated French line ("Ton email n'est pas encore confirmé. Vérifie ta boîte mail (et tes spams)."); the raw Supabase string is never echoed, and every other error (bad credentials excepted) still collapses to the generic line — the NFR-11 rate-limit case included. (GoTrue only returns `email_not_confirmed` after validating the password, so surfacing it leaks nothing — no account enumeration.) — impl `auth-actions.ts:24,33` · test `auth-actions.test.ts:79`.
- [x] **AC-3** — FR and EN message catalogues stay in parity: new `auth.signInError.emailNotConfirmed` key both sides; `auth.signUp.checkEmails` mentions the spam folder in both locales. — `fr.json:74,94` · `en.json:74,94` (parity verified).
- [x] **AC-4** — `docs/security.md` § Auth flows (story 8-1) documents custom SMTP as required hosted config: built-in sender restrictions (org-only + 2/h), FR templates for "Confirm signup" + "Reset password", email rate-limit raised in Auth → Rate Limits. — `security.md:93`.
- [ ] **Manual (dashboard)** — with provider SMTP configured, a signup from a non-team address receives the FR confirmation email (inbox, not spam) and the link lands on `/dashboard` authenticated. — **pending: Alex, dashboard ops (see Manual steps)**.

## Files to Change

- `apps/web/src/app/(auth)/_actions/auth-actions.ts` — `signUp`: pass `options: { emailRedirectTo: `${origin}/callback` }` (reuse `resolveOrigin()`, same as `requestPasswordReset`); `friendlySignInError`: accept `{ message, code }` and map `email_not_confirmed` → new translated line; refresh the sanitisation comment.
- `apps/web/src/app/(auth)/_actions/auth-actions.test.ts` — new cases: signUp passes `emailRedirectTo` containing `/callback`; signIn maps `email_not_confirmed` to the dedicated line without echoing the raw string; existing generic/rate-limit cases stay green.
- `apps/web/messages/fr.json` — add `auth.signInError.emailNotConfirmed`; update `auth.signUp.checkEmails` ("…(et tes spams)…").
- `apps/web/messages/en.json` — same keys, EN copy.
- `docs/security.md` — § Auth flows: add the custom SMTP bullet to the hosted-project configuration list (see AC-4).

## Test Plan

- `apps/web` vitest: `auth-actions.test.ts` — new `signUp` assertion on the `options.emailRedirectTo` argument; new `signIn` case for `email_not_confirmed` (assert the FR line and that the raw message is not leaked); full `(auth)` suite stays green.
- Type check: `bun --filter='@pekulo/web' run typecheck`.
- Manual E2E (after dashboard steps below): signup with a non-team address → FR email received → click link → `/dashboard` logged in; unconfirmed login → dedicated toast line.

## Manual steps (Supabase dashboard — Alex)

1. Create a sending account with a provider (Brevo — FR/EU, free 300 emails/day — or Resend — free 100/day).
2. Verify the sending domain: add the SPF + DKIM DNS records the provider displays; wait for "verified".
3. Supabase → Authentication → SMTP Settings: enable custom SMTP (e.g. Brevo `smtp-relay.brevo.com:587` — SMTP user/key as password), sender `no-reply@<domain>`, name "Pekulo".
4. Supabase → Authentication → Email Templates: switch "Confirm signup" and "Reset password" to FR copy (keep `{{ .ConfirmationURL }}`).
5. Supabase → Authentication → Rate Limits: raise "Emails per hour" (default 30/h once custom SMTP is on).
6. Re-test signup + password reset with a real address outside the org.

## Out of scope

- A "resend confirmation email" action/CTA (`supabase.auth.resend`) — follow-up if the manual re-test still shows lost emails; a second signup with the same unconfirmed address already re-sends the confirmation.
- Switching off email confirmation (`mailer_autoconfirm`) — confirmation stays enabled.

## Result

**Done 2026-10-17** — code + docs green; the dashboard ops (manual AC) stay pending with Alex.

- `auth-actions.ts` — `signUp` passes `options.emailRedirectTo = <origin>/callback` (`:56`); `friendlySignInError({ message, code })` maps `email_not_confirmed` → `auth.signInError.emailNotConfirmed` without echoing raw strings (`:24`), rate-limit stays generic.
- `auth-actions.test.ts` — 2 new cases, RED → GREEN: `:79` (dedicated unconfirmed line, no raw leak), `:116` (`emailRedirectTo` goes through `/callback`).
- `fr.json` / `en.json` — `emailNotConfirmed` + spam-mention in `checkEmails` (`:74`, `:94` both; key parity verified).
- `docs/security.md` — custom-SMTP bullet in § Auth flows (`:93`).
- Evidence: file suite 17/17; full `apps/web` vitest 116 files / 397 tests green (exit 0, `.aped/.last-test-exit = 0`); `@pekulo/web` typecheck exit 0; oxlint 0/0 on the changed TS files.
- **Pending — Alex (dashboard)**: the 6 manual steps above (Brevo/Resend account, SPF/DKIM, SMTP settings, FR templates, email rate limit, real-address re-test). Manual AC stays open until then.
