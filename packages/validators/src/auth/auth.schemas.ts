// packages/validators/src/auth/auth.schemas.ts
// Auth-flow validators (story 8-1, FR-45 / NFR-11). Single source of truth for
// the email + 12-char password policy, shared by the web auth forms (client
// resolver) and the auth server actions (server-side trust boundary).
//
// Conventions: import `z` from @pekulo/zod (never "zod" directly — ADR-0011);
// camelCase + `Schema` suffix; messages in French (communication_language).

import { z } from "@pekulo/zod";

/** NFR-11: minimum password length at signup / reset. */
export const PASSWORD_MIN_LENGTH = 12;

/** AC-1 policy message — surfaced by both the form and the signUp action. */
export const PASSWORD_POLICY_MESSAGE = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;

const email = z.string().trim().min(1, "Email requis").email("Email invalide");
const strongPassword = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE);

/** Signup: email + 12-char password (FR-45). */
export const signupSchema = z.object({ email, password: strongPassword });

/** Login: existing accounts — only require a non-empty password (FR-46). */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});

/** Request a reset email (FR-48, request mode). */
export const passwordResetRequestSchema = z.object({ email });

/** Set a new password from the recovery session (FR-48, reset mode). */
export const passwordUpdateSchema = z.object({ password: strongPassword });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
