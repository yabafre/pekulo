// apps/mobile/lib/i18n/messages/monthly.ts
import type { Shape } from "../types";

export const fr = {
  loadError: "Impossible de charger le suivi mensuel",
  stats: {
    netSavings: "Épargne nette",
    income: "Entrées",
    spending: "Sorties",
  },
  close: {
    aria: "Clôturer {month}",
    cta: "Clôturer {month}",
    done: "{month} est clôturé",
    windowHint: "Clôture possible du {range}",
  },
  history: {
    title: "Historique",
    aria: "Historique mensuel",
    rowHint: "Ouvre les actions du mois",
    closedLabel: "Clôturé",
    emptyTitle: "Aucun bilan mensuel",
    emptyMessage:
      "Vos bilans et clôtures mensuels apparaîtront ici dès que des transactions seront enregistrées.",
  },
  reopen: {
    action: "Rouvrir le mois",
    title: "Rouvrir {month} ?",
    message: "Le mois redevient modifiable et devra être clôturé à nouveau.",
    confirm: "Rouvrir",
    done: "{month} rouvert",
  },
  sheet: {
    title: "Clôturer {month}",
    titleFallback: "Clôturer le mois",
    primary: "Clôturer",
    windowError: "Clôture possible du {range}.",
    footer: "Vérifiez les montants avant de figer le mois. Fenêtre de clôture : {range}.",
    income: "Entrées",
    spending: "Sorties",
    transfers: "Virements",
    netChange: "Variation nette",
    done: "{month} clôturé",
  },
} as const;

export const en: Shape<typeof fr> = {
  loadError: "Couldn’t load your monthly tracking",
  stats: {
    netSavings: "Net savings",
    income: "Income",
    spending: "Spending",
  },
  close: {
    aria: "Close {month}",
    cta: "Close {month}",
    done: "{month} is closed",
    windowHint: "Close-out available {range}",
  },
  history: {
    title: "History",
    aria: "Monthly history",
    rowHint: "Opens the month actions",
    closedLabel: "Closed",
    emptyTitle: "No monthly summaries",
    emptyMessage:
      "Your monthly summaries and close-outs will appear here once transactions are recorded.",
  },
  reopen: {
    action: "Reopen month",
    title: "Reopen {month}?",
    message: "The month becomes editable again and will need to be closed again.",
    confirm: "Reopen",
    done: "{month} reopened",
  },
  sheet: {
    title: "Close {month}",
    titleFallback: "Close the month",
    primary: "Close",
    windowError: "Close-out available {range}.",
    footer: "Check the amounts before freezing the month. Close-out window: {range}.",
    income: "Income",
    spending: "Spending",
    transfers: "Transfers",
    netChange: "Net change",
    done: "{month} closed",
  },
};
