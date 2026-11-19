// apps/mobile/lib/auth/auth-context.tsx
// Mobile authentication context wrapping Supabase Auth + React Query cache purge.
// When `requireAuth` is true (or EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are configured),
// unauthenticated users are directed to `/login`. When unconfigured in local/CI
// preview mode and no initialSession is provided, the app runs in preview fallback
// mode while still allowing explicit sign-in via `/login`.

import type { Session } from "@supabase/supabase-js";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { resetAccessTokenResolver, setAccessTokenResolver } from "../orpc/client";
import { isSupabaseConfigured, supabase } from "../supabase/client";

export function createMobileQueryClient(): QueryClient {
  // Infinite gcTime in Jest avoids TanStack Query's 5-minute GC setTimeout keeping Node open.
  const gcTime = process.env.NODE_ENV === "test" ? Infinity : 5 * 60_000;
  return new QueryClient({
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

export function AuthProvider({ children, initialSession = null, requireAuth }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();
  const enforceAuth = requireAuth ?? configured;

  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState<boolean>(configured && initialSession === null);

  useEffect(() => {
    setAccessTokenResolver(async () => session?.access_token ?? null);
    return () => {
      resetAccessTokenResolver();
    };
  }, [session]);

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
          setSession(data.session ?? null);
          setIsLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setIsLoading(false);
        });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setAccessTokenResolver(async () => nextSession?.access_token ?? null);
      setSession(nextSession);
      if (!nextSession) {
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured, initialSession, queryClient]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        return { ok: false, errorMessage: "Veuillez saisir une adresse e-mail valide." };
      }
      if (password.length < 12) {
        return {
          ok: false,
          errorMessage: "Le mot de passe doit contenir au moins 12 caractères.",
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error || !data.session) {
        return {
          ok: false,
          errorMessage: error?.message ?? "Identifiants invalides.",
        };
      }
      // Update token resolver before invalidating queries so immediate refetches carry the new JWT.
      setAccessTokenResolver(async () => data.session.access_token ?? null);
      setSession(data.session);
      await queryClient.invalidateQueries();
      return { ok: true };
    },
    [queryClient],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut().catch(() => {});
    setAccessTokenResolver(async () => null);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userEmail: session?.user?.email ?? null,
      isAuthenticated: Boolean(session?.access_token),
      isLoading,
      requireAuth: enforceAuth,
      signInWithPassword,
      signOut,
    }),
    [session, isLoading, enforceAuth, signInWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
