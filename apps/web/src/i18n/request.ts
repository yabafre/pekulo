// apps/web/src/i18n/request.ts
// next-intl request config — NO i18n routing. The active locale is read from
// the NEXT_LOCALE cookie (set by the Apparence lang control + the login
// hydrator). Defaults to 'fr' (the app's source language). story 8-2.
//
// next-intl v4: `locale` MUST be returned here (no routing/middleware runs to
// infer it) or every server render throws "Unable to find next-intl locale".
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LANG_VALUES } from "@pekulo/validators";

const DEFAULT_LOCALE = "fr";

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale =
    cookie && (LANG_VALUES as readonly string[]).includes(cookie) ? cookie : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
