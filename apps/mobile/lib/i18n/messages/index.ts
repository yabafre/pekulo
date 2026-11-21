// apps/mobile/lib/i18n/messages/index.ts
// One module per area so screens can be translated independently.
import * as auth from "./auth";
import * as cap from "./cap";
import * as common from "./common";
import * as monthly from "./monthly";
import * as portfolio from "./portfolio";
import * as realestate from "./realestate";
import * as settings from "./settings";
import * as transactions from "./transactions";

export const messages = {
  fr: {
    common: common.fr,
    cap: cap.fr,
    transactions: transactions.fr,
    monthly: monthly.fr,
    portfolio: portfolio.fr,
    realestate: realestate.fr,
    settings: settings.fr,
    auth: auth.fr,
  },
  en: {
    common: common.en,
    cap: cap.en,
    transactions: transactions.en,
    monthly: monthly.en,
    portfolio: portfolio.en,
    realestate: realestate.en,
    settings: settings.en,
    auth: auth.en,
  },
};

export type Messages = typeof messages.fr;
