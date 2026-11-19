// apps/mobile/lib/orpc/client.ts
// Mobile oRPC HTTP link to apps/api (/rpc/v1/*). Forwards the active Supabase
// session JWT as `Authorization: Bearer <access_token>` on every procedure call.

import { RPCLink } from "@orpc/client/fetch";

import { getSupabaseAccessToken } from "../supabase/client";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

export type AccessTokenResolver = () => Promise<string | null> | string | null;

let activeTokenResolver: AccessTokenResolver = getSupabaseAccessToken;

export function setAccessTokenResolver(resolver: AccessTokenResolver): void {
  activeTokenResolver = resolver;
}

export function resetAccessTokenResolver(): void {
  activeTokenResolver = getSupabaseAccessToken;
}

export async function getAccessToken(): Promise<string | null> {
  return await activeTokenResolver();
}

export function getApiBaseUrl(env?: Record<string, string | undefined>): string {
  // Direct member read lets babel-preset-expo statically inline EXPO_PUBLIC_API_BASE_URL in native bundles.
  const raw = (env ? env.EXPO_PUBLIC_API_BASE_URL : process.env.EXPO_PUBLIC_API_BASE_URL)?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, "");
}

export interface CreateMobileOrpcLinkOptions {
  baseUrl?: () => string;
  tokenResolver?: AccessTokenResolver;
  fetch?: typeof globalThis.fetch;
}

export function createMobileOrpcLink(options: CreateMobileOrpcLinkOptions = {}): RPCLink<object> {
  const resolveBaseUrl = options.baseUrl ?? (() => getApiBaseUrl());
  const resolveToken = options.tokenResolver ?? getAccessToken;

  return new RPCLink({
    url: () => `${resolveBaseUrl()}/rpc/v1`,
    fetch: options.fetch,
    headers: async () => {
      const token = await resolveToken();
      if (!token) return {};
      return {
        Authorization: `Bearer ${token}`,
      };
    },
  });
}

export const orpcLink = createMobileOrpcLink();
