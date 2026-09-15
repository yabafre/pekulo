// A syntactically valid, UNSIGNED service-role JWT for env fixtures. env.ts
// only inspects the payload's `role` claim (looksLikeServiceRoleKey); nothing
// verifies the signature, so "sig" is enough and no secret is embedded.
function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function fakeSupabaseKey(role: string): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ iss: "supabase", role })}.sig`;
}

export const SERVICE_ROLE_KEY_FIXTURE = fakeSupabaseKey("service_role");
