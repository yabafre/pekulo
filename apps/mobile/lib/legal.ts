// apps/mobile/lib/legal.ts
// Canonical public web URLs for App Store & Google Play compliance (story 10-7, AC-2).
import { Linking } from "react-native";

export type LegalPath = "/privacy" | "/terms" | "/support" | "/account-deletion";

const DEFAULT_WEB_BASE_URL = "https://pekulo.app";

export function getLegalUrl(path: LegalPath, env?: Record<string, string | undefined>): string {
  const raw = (env ? env.EXPO_PUBLIC_WEB_BASE_URL : process.env.EXPO_PUBLIC_WEB_BASE_URL)?.trim();
  const base = raw && /^https:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : DEFAULT_WEB_BASE_URL;
  return `${base}${path}`;
}

export async function openLegalUrl(path: LegalPath): Promise<void> {
  await Linking.openURL(getLegalUrl(path));
}
