// apps/mobile/lib/supabase/client.ts
// React Native Supabase Auth client backed by chunked expo-secure-store.
// Safe when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are unset
// (local preview / CI test mode): `isSupabaseConfigured()` returns false so
// AuthProvider can degrade cleanly without network calls unless mocked.
// Direct `process.env.EXPO_PUBLIC_*` member reads allow `babel-preset-expo` to
// inline values statically in Hermes native bundles while still permitting
// explicit `env` injection in unit tests.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { chunkedSecureStorage } from "./secure-storage";

/**
 * Explicit storage key so the purge below can address the persisted session
 * without reaching into supabase-js internals. (The default key derives from
 * the project URL; pinning it also survives a project-URL change.)
 */
export const AUTH_STORAGE_KEY = "pekulo-mobile-auth";

const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "placeholder-anon-key";

function readSupabaseUrl(env?: Record<string, string | undefined>): string | undefined {
  return (env ? env.EXPO_PUBLIC_SUPABASE_URL : process.env.EXPO_PUBLIC_SUPABASE_URL)?.trim();
}

function readSupabaseAnonKey(env?: Record<string, string | undefined>): string | undefined {
  return (
    env ? env.EXPO_PUBLIC_SUPABASE_ANON_KEY : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
}

export function isSupabaseConfigured(env?: Record<string, string | undefined>): boolean {
  return Boolean(readSupabaseUrl(env) && readSupabaseAnonKey(env));
}

export function getSupabaseConfig(env?: Record<string, string | undefined>): {
  url: string;
  anonKey: string;
  configured: boolean;
} {
  const url = readSupabaseUrl(env);
  const anonKey = readSupabaseAnonKey(env);
  const configured = Boolean(url && anonKey);
  return {
    url: url || FALLBACK_SUPABASE_URL,
    anonKey: anonKey || FALLBACK_SUPABASE_ANON_KEY,
    configured,
  };
}

const initialConfig = getSupabaseConfig();

export const supabase: SupabaseClient = createClient(initialConfig.url, initialConfig.anonKey, {
  auth: {
    storage: chunkedSecureStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: initialConfig.configured,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session.access_token ?? null;
}

/**
 * Remove the persisted session (manifest + every chunk) from secure storage.
 * `supabase.auth.signOut()` skips its own local removal when the revoke call
 * fails for a network reason, so sign-out always finishes with this.
 */
export async function purgeStoredSession(): Promise<void> {
  await chunkedSecureStorage.removeItem(AUTH_STORAGE_KEY);
  await chunkedSecureStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
}
