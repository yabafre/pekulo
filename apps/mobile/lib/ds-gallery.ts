// apps/mobile/lib/ds-gallery.ts
// Story 10-5 AC-4 — DS gallery switches. The gallery renders @pekulo/ui parity
// cases for the Maestro ds-gallery flow; it is only reachable in builds made
// with EXPO_PUBLIC_DS_GALLERY=1 (the `e2e-test` EAS profile).
// Direct `process.env.EXPO_PUBLIC_*` member read so babel-preset-expo inlines
// it in native bundles; `env` injection is for unit tests (same pattern as
// lib/supabase/client.ts).
import type { ParityTheme } from "@pekulo/ui/parity";

export function isDsGalleryEnabled(env?: Record<string, string | undefined>): boolean {
  const raw = env ? env.EXPO_PUBLIC_DS_GALLERY : process.env.EXPO_PUBLIC_DS_GALLERY;
  return raw?.trim() === "1";
}

export function resolveGalleryTheme(raw: string | string[] | undefined): ParityTheme {
  return raw === "pekulo-light" ? "pekulo-light" : "pekulo-dark";
}
