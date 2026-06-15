// Shared name of the short-lived, httpOnly cookie the auth callback sets when a
// verified password-recovery code exchange redirects to /recover. It is the
// only server-readable signal that distinguishes a *recovery* session from a
// normal one — Supabase's `amr` claim does not carry a "recovery" method
// (auth-js AMRMethods omits it). Kept in one place so the setter (callback),
// the reader (/recover page) and the cleaner (updatePassword action) can never
// drift on the literal (aped-review M1, story 8-1).
export const RECOVERY_MARKER_COOKIE = "pekulo-pwd-recovery";
