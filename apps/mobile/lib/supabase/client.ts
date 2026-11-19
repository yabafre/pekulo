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
