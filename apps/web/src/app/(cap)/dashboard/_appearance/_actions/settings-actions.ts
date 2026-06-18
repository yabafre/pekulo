"use server";

import { cookies } from "next/headers";
import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import { updateLangInputSchema, updateThemeInputSchema, type UserPref } from "@pekulo/validators";
import { settingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { settingsTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 8-2 — thin oRPC delegators (ADR-0010 hard layering; zero business
// logic on the web tier). No cross-feature action import.
export const getSettings = defineAction<void, UserPref, ActionContext>({
  name: "getSettings",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return settingsClient.get();
  },
});

export const updateTheme = defineAction<
  z.infer<typeof updateThemeInputSchema>,
  UserPref,
  ActionContext
>({
  name: "updateTheme",
  input: updateThemeInputSchema,
  tags: [settingsTags.current()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return settingsClient.updateTheme(input);
  },
});

export const updateLang = defineAction<
  z.infer<typeof updateLangInputSchema>,
  UserPref,
  ActionContext
>({
  name: "updateLang",
  input: updateLangInputSchema,
  tags: [settingsTags.current()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    const pref = await settingsClient.updateLang(input);
    // SSR locale source — getRequestConfig reads this cookie (T12). 1-year maxAge.
    (await cookies()).set("NEXT_LOCALE", input.lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return pref;
  },
});
