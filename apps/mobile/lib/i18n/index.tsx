// apps/mobile/lib/i18n/index.tsx
// Lightweight typed i18n for apps/mobile (no runtime dependency). The active
// language comes from the user's `settings.lang` preference, so switching it
// in Paramètres re-renders every screen immediately. Outside a provider
// (unit tests rendering a lone screen) it falls back to French.

import { createContext, use, useMemo, type ReactNode } from "react";

import { messages, type Messages } from "./messages";
import type { Lang } from "./types";

export type { Lang } from "./types";

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** Intl locale per language (numbers and dates). */
export const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

export function translate(lang: Lang, key: MessageKey, vars?: TranslateVars): string {
  let node: unknown = messages[lang];
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  let text = typeof node === "string" ? node : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

const I18nContext = createContext<Lang>("fr");

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nContext value={lang}>{children}</I18nContext>;
}

export function useI18n(): { lang: Lang; locale: string; t: Translate } {
  const lang = use(I18nContext);
  return useMemo(
    () => ({
      lang,
      locale: LOCALES[lang],
      t: (key: MessageKey, vars?: TranslateVars) => translate(lang, key, vars),
    }),
    [lang],
  );
}
