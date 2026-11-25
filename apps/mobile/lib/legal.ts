// apps/mobile/lib/legal.ts
// Canonical public web URLs for App Store & Google Play compliance (story 10-7, AC-2).
import { Linking } from "react-native";

export type LegalPath = "/privacy" | "/terms" | "/support" | "/account-deletion";

const DEFAULT_WEB_BASE_URL = "https://pekulo.app";

function parseSafeHttpsBase(raw: string | undefined): string {
  if (!raw) return DEFAULT_WEB_BASE_URL;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.length === 0 ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return DEFAULT_WEB_BASE_URL;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return DEFAULT_WEB_BASE_URL;
  }
}

export function getLegalUrl(path: LegalPath, env?: Record<string, string | undefined>): string {
  const raw = (env ? env.EXPO_PUBLIC_WEB_BASE_URL : process.env.EXPO_PUBLIC_WEB_BASE_URL)?.trim();
  return `${parseSafeHttpsBase(raw)}${path}`;
}

export async function openLegalUrl(path: LegalPath): Promise<boolean> {
  try {
    await Linking.openURL(getLegalUrl(path));
    return true;
  } catch {
    return false;
  }
}
