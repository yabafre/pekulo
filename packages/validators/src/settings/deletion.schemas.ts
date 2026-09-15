// Zod source of truth for GDPR account deletion (story 11-2, FR-50).
// Consumed by @pekulo/contracts (oRPC procedure I/O), the apps/api settings
// service, and the apps/web server action.
//
// Named `deleteUserAccount*`, not `deleteAccount*`: the accounts domain
// already owns `deleteAccountInputSchema` for removing a BANK account (FR-10),
// and both ship through the same package barrel. This one erases the user.
import { z } from "@pekulo/zod";

// The typed confirmation. The dialog asks for the account's email address and
// the SERVER compares it to the email on the verified JWT — this is an
// authorization check, not a UX flourish: a direct RPC call with no dialog
// must still have to name the account it is destroying.
export const deleteUserAccountInputSchema = z.object({
  confirmationEmail: z.string().min(1).max(320),
});
export type DeleteUserAccountInput = z.infer<typeof deleteUserAccountInputSchema>;

// rowsDeleted is keyed by the DELETION_NODES key (the table name) and carries
// the row count Prisma reported for that table. It is the caller's own data,
// it makes AC-1 assertable end to end, and it is what the structured
// completion log records.
export const deleteUserAccountResultSchema = z.object({
  ok: z.literal(true),
  rowsDeleted: z.record(z.string(), z.number().int().nonnegative()),
  vaultSecretsPurged: z.number().int().nonnegative(),
});
export type DeleteUserAccountResult = z.infer<typeof deleteUserAccountResultSchema>;
