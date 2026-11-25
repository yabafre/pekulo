// apps/mobile/lib/account-deletion.ts
// Story 10-6 AC-4 — typed-email confirmation shared by the iOS `Alert.prompt`
// path (app/parametres.tsx) and the Android sheet (app/sheets/delete-account.tsx).
// Case- and surrounding-space-insensitive. An unknown account email never
// confirms (the 10-4 inline check accepted "   " when the email was missing).

export function isDeletionEmailConfirmed(
  typed: string | undefined,
  accountEmail: string | null | undefined,
): boolean {
  const expected = (accountEmail ?? "").trim().toLowerCase();
  if (!typed || expected === "") return false;
  return typed.trim().toLowerCase() === expected;
}
