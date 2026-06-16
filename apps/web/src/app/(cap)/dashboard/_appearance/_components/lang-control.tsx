"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PekuloSegmentedControl } from "@pekulo/ui";
import { LANG_VALUES, type LangPref } from "@pekulo/validators";
import { updateLang } from "../_actions/settings-actions";

export function LangControl() {
  const t = useTranslations("settings");
  const router = useRouter();
  const locale = useLocale() as LangPref;
  const options = LANG_VALUES.map((v) => ({ value: v, label: t(`lang.${v}`), icon: Globe }));
  return (
    <PekuloSegmentedControl<LangPref>
      value={locale}
      ariaLabel={t("appearance.language")}
      options={options}
      onChange={(v) => {
        if (v === locale) return;
        // updateLang persists + sets the NEXT_LOCALE cookie server-side;
        // router.refresh() re-renders the RSC tree in the new locale (AC-4).
        void updateLang({ lang: v }).then(() => router.refresh());
      }}
    />
  );
}
