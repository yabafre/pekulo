// apps/mobile/lib/auth/auth-context.tsx
// Mobile authentication context wrapping Supabase Auth + React Query cache purge.
// When `requireAuth` is true (or EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are configured),
// unauthenticated users are directed to `/login`. When unconfigured in local/CI
// preview mode and no initialSession is provided, the app runs in preview fallback
// mode while still allowing explicit sign-in via `/login`.

import type { Session } from "@supabase/supabase-js";
import { MutationCache, QueryCache, QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { tNow } from "../i18n";
import { resetAccessTokenResolver, setAccessTokenResolver } from "../orpc/client";
import { isUnauthorizedError } from "../orpc/errors";
import {
  getSupabaseAccessToken,
  isSupabaseConfigured,
  purgeStoredSession,
  supabase,
} from "../supabase/client";

// The API answered 401 to a request that carried a token: the session is gone
// server-side (revoked, expired beyond refresh). The mounted AuthProvider
// registers the handler that ends the local session.
let unauthorizedHandler: (() => void) | null = null;

function notifyIfUnauthorized(error: unknown): void {
  if (isUnauthorizedError(error)) unauthorizedHandler?.();
}

export function createMobileQueryClient(): QueryClient {
  // Infinite gcTime in Jest avoids TanStack Query's 5-minute GC setTimeout keeping Node open.
  const gcTime = process.env.NODE_ENV === "test" ? Infinity : 5 * 60_000;
  return new QueryClient({
    queryCache: new QueryCache({ onError: notifyIfUnauthorized }),
    mutationCache: new MutationCache({ onError: notifyIfUnauthorized }),
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
        gcTime,
      },
      mutations: {
        retry: false,
        gcTime,
      },
    },
  });
}

export interface SignInResult {
  ok: boolean;
  errorMessage?: string;
}

export interface AuthContextValue {
  session: Session | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requireAuth: boolean;
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userEmail: null,
  isAuthenticated: false,
  isLoading: false,
  requireAuth: false,
  signInWithPassword: async () => ({ ok: false, errorMessage: "AuthProvider non initialisé" }),
  signOut: async () => {},
});

export interface AuthProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
  requireAuth?: boolean;
}

// Story 10-7 (AC-4) — fail fast in release builds if Supabase env vars are missing
// unless preview mode is explicitly opted in (e.g. EAS `e2e-test` profile).
export function assertReleaseSupabaseConfigured(
  configured: boolean,
  env?: Record<string, string | undefined>,
  isDev: boolean = __DEV__,
): void {
  if (isDev || configured) return;
  const allowPreview = (
    env ? env.EXPO_PUBLIC_ALLOW_PREVIEW : process.env.EXPO_PUBLIC_ALLOW_PREVIEW
  )?.trim();
  if (allowPreview === "1") return;
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in release builds",
  );
}

export function AuthProvider({ children, initialSession = null, requireAuth }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();
  if (requireAuth === undefined && initialSession === null) {
    assertReleaseSupabaseConfigured(configured);
  }
  const enforceAuth = requireAuth ?? configured;

  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState<boolean>(configured && initialSession === null);
  const sessionRef = useRef<Session | null>(initialSession);

  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  // Read the token at request time. With Supabase configured, `getSession()`
  // refreshes an expired access token, so a request after the app has been
  // backgrounded never carries a stale JWT; the session ref covers injected
  // sessions (tests, preview) where Supabase isn't configured. A layout effect
  // runs before any child query effect fires its first request.
  useLayoutEffect(() => {
    setAccessTokenResolver(async () => {
      if (configured) {
        const fresh = await getSupabaseAccessToken();
        if (fresh) return fresh;
      }
      return sessionRef.current?.access_token ?? null;
    });
    return () => {
      resetAccessTokenResolver();
    };
  }, [configured]);

  // React Native has no tab visibility: supabase-js only auto-refreshes while
  // told the app is in the foreground.
  useEffect(() => {
    if (!configured) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }

    let active = true;

    if (initialSession === null) {
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          applySession(data.session ?? null);
          setIsLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setIsLoading(false);
        });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      applySession(nextSession);
      if (!nextSession) {
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession, configured, initialSession, queryClient]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        return { ok: false, errorMessage: tNow("auth.errors.emailInvalid") };
      }
      if (password.length < 12) {
        return {
          ok: false,
          errorMessage: tNow("auth.errors.passwordTooShort"),
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error || !data.session) {
        return {
          ok: false,
          // Supabase returns English text ("Invalid login credentials"); show a
          // localised message instead, keeping other server messages as-is.
          errorMessage:
            !error ||
            error.code === "invalid_credentials" ||
            /invalid login credentials/i.test(error.message)
              ? tNow("auth.errors.invalidCredentials")
              : error.message,
        };
      }
      // The ref feeds the token resolver, so set it before invalidating queries:
      // immediate refetches must carry the new JWT.
      applySession(data.session);
      await queryClient.invalidateQueries();
      return { ok: true };
    },
    [applySession, queryClient],
  );

  const signOut = useCallback(async (): Promise<void> => {
    // supabase-js revokes the refresh token server-side, but when that call
    // fails for a network reason it resolves with `{ error }` WITHOUT removing
    // the stored session — so purge the manifest and every chunk ourselves.
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline or already revoked: the local purge below still ends the session.
    }
    await purgeStoredSession().catch(() => {});
    applySession(null);
    queryClient.clear();
  }, [applySession, queryClient]);

  const isAuthenticated = Boolean(session?.access_token);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ending = false;
    unauthorizedHandler = () => {
      if (ending) return;
      ending = true;
      void signOut();
    };
    return () => {
      unauthorizedHandler = null;
    };
  }, [isAuthenticated, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userEmail: session?.user?.email ?? null,
      isAuthenticated,
      isLoading,
      requireAuth: enforceAuth,
      signInWithPassword,
      signOut,
    }),
    [session, isAuthenticated, isLoading, enforceAuth, signInWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
