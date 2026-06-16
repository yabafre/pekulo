"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useThemeSetting } from "@tamagui/next-theme";
import { useLocale } from "next-intl";
import type { ThemePref, LangPref } from "@pekulo/validators";

// Story 8-2 AC-6 — on the first authenticated render of a fresh device, apply
// the server-persisted pref. Theme applies instantly via next-theme (writes
// localStorage + data-theme); locale needs a NEXT_LOCALE cookie write +
// router.refresh() to re-render the RSC tree in the new locale. The ref guards
// against re-running on every re-render within a session.
export function PreferenceHydrator({ pref }: { pref: { theme: ThemePref; lang: LangPref } }) {
  const { set } = useThemeSetting();
  const locale = useLocale();
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    set(pref.theme);
    if (pref.lang !== locale) {
      document.cookie = `NEXT_LOCALE=${pref.lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.refresh();
    }
  }, [pref, locale, set, router]);
  return null;
}
