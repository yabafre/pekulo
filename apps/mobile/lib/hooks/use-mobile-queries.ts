// apps/mobile/lib/hooks/use-mobile-queries.ts
// Custom React Query hooks for apps/mobile (ADR-0010 boundary: screens never
// call oRPC clients directly). When authenticated, fetches live data from
// `@pekulo/contracts` module clients (`dashboardClient`, `compassClient`,
// `milestonesClient`, `accountsClient`, `holdingsClient`, `realestateClient`,
// `transactionsClient`, `monthlyClient`, `settingsClient`). When running in
// unauthenticated local/CI preview mode, returns deterministic baseline data.

import type {
  AccountCardItem,
  Activity,
  CompositionItem,
  HoldingCardItem,
  HoldingKind,
  LlmRouteBadge,
  MilestoneCardItem,
  MonthlyDisplayRow,
  PropertyCardItem,
  Suggestion,
} from "@pekulo/types";
import {
  formatMonthLabel,
  type LangPref,
  type SuggestableTransactionCategory,
  type ThemePref,
  type Transaction,
} from "@pekulo/validators";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { currentUtcMonth } from "../forms";
import { useI18n, type Lang, type Translate } from "../i18n";
import { categoryLabel } from "../options";
import {
  accountsClient,
  compassClient,
  dashboardClient,
  holdingsClient,
  milestonesClient,
  monthlyClient,
  realestateClient,
  settingsClient,
  transactionsClient,
} from "../orpc/modules";

export const mobileQueryKeys = {
  cap: () => ["mobile", "cap"] as const,
  transactions: () => ["mobile", "transactions"] as const,
  monthly: () => ["mobile", "monthly"] as const,
  portfolio: () => ["mobile", "portfolio"] as const,
  realestate: () => ["mobile", "realestate"] as const,
  settings: () => ["mobile", "settings"] as const,
  compass: () => ["mobile", "compass"] as const,
  llm: () => ["mobile", "llm"] as const,
  // Called without an id these are prefixes, so invalidating them refreshes
  // every property detail / valuation history currently cached.
  property: (id?: string) =>
    id ? (["mobile", "property", id] as const) : (["mobile", "property"] as const),
  valuations: (id?: string) =>
    id ? (["mobile", "valuations", id] as const) : (["mobile", "valuations"] as const),
};

/** `{ value, label }` pairs for the native select fields of the edit sheets. */
export interface MobileSelectOption {
  value: string;
  label: string;
}

const MONTH_SHORT_EN = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(lang: Lang, year: number, monthNum: number): string {
  if (lang === "fr") return formatMonthLabel(year, monthNum);
  return MONTH_SHORT_EN.format(new Date(Date.UTC(year, monthNum - 1, 1)));
}

function compositionItems(
  t: Translate,
  amounts: { liquid: number; investments: number; realestate: number },
): CompositionItem[] {
  const total = Math.max(
    1,
    Math.max(0, amounts.liquid) +
      Math.max(0, amounts.investments) +
      Math.max(0, amounts.realestate),
  );
  return [
    {
      label: t("common.composition.liquid"),
      amount: amounts.liquid,
      pct: Math.max(0, amounts.liquid) / total,
      sub: t("common.composition.liquidSub"),
    },
    {
      label: t("common.composition.investments"),
      amount: amounts.investments,
      pct: Math.max(0, amounts.investments) / total,
      sub: t("common.composition.investmentsSub"),
    },
    {
      label: t("common.composition.realestate"),
      amount: amounts.realestate,
      pct: Math.max(0, amounts.realestate) / total,
      sub: t("common.composition.realestateSub"),
    },
  ];
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface MobileCapViewData {
  totalEur: number;
  aheadEur: number;
  targetCapital: number;
  targetYear: number;
  requiredYearlyEur: number;
  progressRatio: number;
  progressLabel: string;
  nextMilestoneLabel: string;
  composition: CompositionItem[];
  milestones: MilestoneCardItem[];
  recentActivity: Activity[];
  accounts: AccountCardItem[];
  /** Raw accounts (ids + editable fields) behind `accounts`, same order. */
  accountEntities: MobileAccountEntity[];
}

export interface MobileAccountEntity {
  id: string;
  label: string;
  type: AccountCardItem["type"];
  currency: "EUR" | "USD" | "GBP" | "CHF";
  cashBalance: number;
  notes: string | null;
}

const previewCapData = (t: Translate): MobileCapViewData => ({
  totalEur: 180400,
  aheadEur: 2781,
  targetCapital: 800000,
  targetYear: 2055,
  requiredYearlyEur: 20653,
  progressRatio: 0.226,
  progressLabel: "22,6 %",
  nextMilestoneLabel: "100 k€ · 2032",
  composition: compositionItems(t, { liquid: 24500, investments: 85900, realestate: 70000 }),
  milestones: [
    {
      id: "mst_preview_1",
      label: "Palier 100 k€",
      targetEur: 100000,
      targetYear: 2032,
      progressPct: 1,
      deltaEur: 10400,
      status: "ahead",
    },
    {
      id: "mst_preview_2",
      label: "Palier 300 k€",
      targetEur: 300000,
      targetYear: 2042,
      progressPct: 0.37,
      deltaEur: 2781,
      status: "on-track",
    },
  ],
  recentActivity: [
    {
      label: "Virement programmé PEA",
      account: "Trade Republic",
      category: categoryLabel(t, "transfer"),
      direction: "in",
      amountEur: 600,
    },
    {
      label: "Courses Carrefour",
      account: "Société Générale",
      category: categoryLabel(t, "courses"),
      direction: "out",
      amountEur: 84,
    },
  ],
  accounts: [
    { label: "Livret A", type: "livret", balanceEur: 22950 },
    { label: "Compte courant", type: "banque", balanceEur: 1550 },
  ],
  accountEntities: [
    {
      id: "acc_previewLivretA000000",
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 22950,
      notes: null,
    },
    {
      id: "acc_previewCourant000000",
      label: "Compte courant",
      type: "banque",
      currency: "EUR",
      cashBalance: 1550,
      notes: null,
    },
  ],
});

function formatCompactMilestone(targetCapital: number, targetYear: number): string {
  if (targetCapital >= 1000 && targetCapital % 1000 === 0) {
    return `${Math.round(targetCapital / 1000)} k€ · ${targetYear}`;
  }
  return `${eur0.format(targetCapital)} · ${targetYear}`;
}

export function useMobileCapData() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();

  return useQuery<MobileCapViewData>({
    queryKey: [...mobileQueryKeys.cap(), isAuthenticated, lang],
    queryFn: async () => {
      if (!isAuthenticated) {
        return previewCapData(t);
      }

      const [overview, compass, milestonesList, accountsList] = await Promise.all([
        dashboardClient.getOverview(),
        compassClient.getCompass(),
        milestonesClient.list(),
        accountsClient.list(),
      ]);

      const currentInvestableWealth =
        overview.compass?.currentWealth ?? Math.max(0, overview.totalWealthEur);
      const statuses =
        milestonesList.length > 0
          ? await milestonesClient.getStatuses({
              currentWealth: Math.max(0, currentInvestableWealth),
            })
          : [];
      const statusById = new Map(statuses.map((s) => [s.id, s]));

      const currentYear = new Date().getUTCFullYear();
      const horizonYears = compass?.horizonYears ?? 30;
      const targetYear = currentYear + horizonYears;
      const targetCapital = compass?.objectif ?? overview.compass?.objectif ?? 800000;
      const remaining = Math.max(0, targetCapital - overview.totalWealthEur);
      const requiredYearlyEur = Math.round(remaining / Math.max(1, horizonYears));

      const percentNum =
        overview.compass?.percent ??
        (targetCapital > 0 ? (overview.totalWealthEur / targetCapital) * 100 : 0);
      const progressLabel = `${percentNum.toFixed(1).replace(".", ",")} %`;

      const milestones: MilestoneCardItem[] = milestonesList.map((m) => {
        const st = statusById.get(m.id);
        const progressPct =
          m.targetCapital > 0
            ? Math.max(0, Math.min(1, currentInvestableWealth / m.targetCapital))
            : 0;
        return {
          id: m.id,
          label: m.label ?? t("common.fallback.milestone", { year: m.targetYear }),
          targetEur: m.targetCapital,
          targetYear: m.targetYear,
          progressPct,
          deltaEur: st ? -st.delta : 0,
          status: st?.status ?? "on-track",
        };
      });

      const nextMilestone = milestonesList[0];
      const nextMilestoneLabel = nextMilestone
        ? formatCompactMilestone(nextMilestone.targetCapital, nextMilestone.targetYear)
        : t("common.fallback.noMilestone");

      const composition = compositionItems(t, {
        liquid: overview.composition.liquideEur,
        investments: overview.composition.placementsEur,
        realestate: overview.composition.immobilierEur,
      });

      const recentActivity: Activity[] = overview.recentActivity.map((act) => ({
        label: act.label,
        account: act.account,
        category: categoryLabel(t, act.category),
        direction: act.direction,
        amountEur: act.amountEur,
        logoUrl: act.logoUrl ?? null,
      }));

      const accounts: AccountCardItem[] = accountsList.map((acc) => ({
        label: acc.label,
        type: acc.type,
        balanceEur: acc.cashBalance,
      }));

      const accountEntities: MobileAccountEntity[] = accountsList.map((acc) => ({
        id: acc.id,
        label: acc.label,
        type: acc.type,
        currency: acc.currency,
        cashBalance: acc.cashBalance,
        notes: acc.notes,
      }));

      const firstDelta = statuses[0] ? -statuses[0].delta : 0;

      return {
        totalEur: overview.totalWealthEur,
        aheadEur: Math.round(firstDelta),
        targetCapital,
        targetYear,
        requiredYearlyEur,
        progressRatio: Math.max(0, Math.min(1, percentNum / 100)),
        progressLabel,
        nextMilestoneLabel,
        composition,
        milestones,
        recentActivity,
        accounts,
        accountEntities,
      };
    },
  });
}

export interface MobilePendingSuggestionItem {
  id: string;
  rawCategory: SuggestableTransactionCategory;
  suggestion: Suggestion;
}

export interface MobileTransactionsViewData {
  monthLabel: string;
  netFormatted: string;
  netTone?: "gain" | "loss";
  incomeFormatted: string;
  spendingFormatted: string;
  pendingSuggestions: MobilePendingSuggestionItem[];
  recentTransactions: Activity[];
  /** Same order as `recentTransactions`, with the raw row for edit sheets. */
  rows: MobileTransactionRow[];
  accountOptions: MobileSelectOption[];
}

export interface MobileTransactionRow {
  id: string;
  /** `null` in preview mode, where no editable record exists. */
  raw: Transaction | null;
  activity: Activity;
}

const previewTransactionActivities = (t: Translate): Activity[] => [
  {
    label: "Salaire Mai",
    account: "Société Générale",
    category: categoryLabel(t, "salaire"),
    direction: "in",
    amountEur: 3200,
  },
  {
    label: "Courses Carrefour",
    account: "Société Générale",
    category: categoryLabel(t, "courses"),
    direction: "out",
    amountEur: 120,
  },
];

const previewTransactionsData = (t: Translate): MobileTransactionsViewData => ({
  monthLabel: "2026-05",
  netFormatted: "+1 050 €",
  netTone: "gain",
  incomeFormatted: "+3 200 €",
  spendingFormatted: "−2 150 €",
  pendingSuggestions: [],
  recentTransactions: previewTransactionActivities(t),
  rows: previewTransactionActivities(t).map((activity, index) => ({
    id: `tx_preview${index}`,
    raw: null,
    activity,
  })),
  accountOptions: [{ value: "acc_previewCourant000000", label: "Société Générale" }],
});

function mapLlmRouteToBadge(route: string | null | undefined): LlmRouteBadge {
  if (route === "foundation_models" || route === "ios") return "ios";
  if (route === "third_party" || route === "cloud") return "cloud";
  return "ollama";
}

function formatSignedEur(amount: number): string {
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}${eur0.format(Math.abs(amount))}`;
}

/** `month` is a `YYYY-MM` key; omitted means the server's current month. */
export function useMobileTransactionsData(month?: string) {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();

  return useQuery<MobileTransactionsViewData>({
    queryKey: [...mobileQueryKeys.transactions(), isAuthenticated, month ?? "current", lang],
    queryFn: async () => {
      if (!isAuthenticated) {
        const preview = previewTransactionsData(t);
        return month ? { ...preview, monthLabel: month } : preview;
      }

      const [summary, pending, list, accounts] = await Promise.all([
        transactionsClient.monthSummary(month ? { month } : {}),
        transactionsClient.listPendingSuggestions({ page: 1, pageSize: 10 }),
        transactionsClient.listTransactions(month ? { limit: 100, month } : { limit: 100 }),
        accountsClient.list(),
      ]);

      const accountLabelById = new Map(accounts.map((a) => [a.id, a.label]));

      const pendingSuggestions: MobilePendingSuggestionItem[] = pending.items
        .filter((tx) => Boolean(tx.suggestedCategory))
        .map((tx) => {
          const rawCat = (tx.suggestedCategory ?? "courses") as SuggestableTransactionCategory;
          return {
            id: tx.id,
            rawCategory: rawCat,
            suggestion: {
              label: tx.label,
              account: accountLabelById.get(tx.accountId) ?? t("common.fallback.account"),
              dateLabel: tx.occurredOn,
              direction: tx.type === "inflow" ? "in" : "out",
              amountEur: tx.amount,
              suggestedCategory: categoryLabel(t, rawCat),
              confidence: tx.suggestedConfidence ?? 0.9,
              route: mapLlmRouteToBadge(tx.suggestedRoute),
              logoUrl: tx.logoUrl ?? null,
            },
          };
        });

      const rows: MobileTransactionRow[] = list.items.map((tx) => ({
        id: tx.id,
        raw: tx,
        activity: {
          label: tx.label,
          account: accountLabelById.get(tx.accountId) ?? t("common.fallback.account"),
          category: categoryLabel(t, tx.category),
          direction: tx.type === "inflow" ? "in" : "out",
          amountEur: tx.amount,
          logoUrl: tx.logoUrl ?? null,
        },
      }));
      const recentTransactions: Activity[] = rows.map((row) => row.activity);

      return {
        monthLabel: summary.month,
        netFormatted: formatSignedEur(summary.netChangeEur),
        netTone: summary.netChangeEur >= 0 ? "gain" : "loss",
        incomeFormatted: `+${eur0.format(summary.incomeEur)}`,
        spendingFormatted: `−${eur0.format(summary.spendingEur)}`,
        pendingSuggestions,
        recentTransactions,
        rows,
        accountOptions: accounts.map((a) => ({ value: a.id, label: a.label })),
      };
    },
  });
}

export function useConfirmMobileSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; category: SuggestableTransactionCategory }) => {
      return await transactionsClient.confirmCategorisation(input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mobileQueryKeys.transactions() }),
        queryClient.invalidateQueries({ queryKey: mobileQueryKeys.cap() }),
      ]);
    },
  });
}

export interface MobileMonthlyViewData {
  currentNetFormatted: string;
  currentNetTone?: "gain" | "loss";
  currentIncomeFormatted: string;
  currentSpendingFormatted: string;
  months: MonthlyDisplayRow[];
  /** Year / month behind each `months` row (same order), for reopen. */
  monthKeys: { year: number; monthNum: number }[];
  /** Current UTC month figures, prefilled into the sign-off sheet. */
  current: MobileMonthlyCurrent;
}

export interface MobileMonthlyCurrent {
  year: number;
  monthNum: number;
  incomeEur: number;
  spendingEur: number;
  transfersEur: number;
  netChangeEur: number;
  signedOff: boolean;
}

const PREVIEW_MONTHLY_DATA: MobileMonthlyViewData = {
  currentNetFormatted: "+1 240 €",
  currentNetTone: "gain",
  currentIncomeFormatted: "+3 400 €",
  currentSpendingFormatted: "−2 160 €",
  months: [
    {
      monthLabel: "mai 2026",
      incomeEur: 3400,
      spendingEur: 2160,
      netEur: 1240,
      closed: false,
    },
    {
      monthLabel: "avr. 2026",
      incomeEur: 3200,
      spendingEur: 1950,
      netEur: 1250,
      closed: true,
    },
  ],
  monthKeys: [
    { year: 2026, monthNum: 5 },
    { year: 2026, monthNum: 4 },
  ],
  current: {
    ...currentUtcMonth(),
    incomeEur: 3400,
    spendingEur: 2160,
    transfersEur: 0,
    netChangeEur: 1240,
    signedOff: false,
  },
};

export function useMobileMonthlyData() {
  const { isAuthenticated } = useAuth();
  const { lang } = useI18n();

  return useQuery<MobileMonthlyViewData>({
    queryKey: [...mobileQueryKeys.monthly(), isAuthenticated, lang],
    queryFn: async () => {
      if (!isAuthenticated) {
        return PREVIEW_MONTHLY_DATA;
      }

      const { year, monthNum } = currentUtcMonth();
      const [response, currentMonthly] = await Promise.all([
        monthlyClient.listMonthly({ limit: 12 }),
        monthlyClient.getMonthly({ year, monthNum }),
      ]);
      const currentRecord = currentMonthly.record;
      const current: MobileMonthlyCurrent = {
        year,
        monthNum,
        incomeEur: currentRecord.incomeEur,
        spendingEur: currentRecord.spendingEur,
        transfersEur: currentRecord.transfersEur,
        netChangeEur: currentRecord.netChangeEur,
        signedOff: currentRecord.signedOffAt !== null,
      };
      const months: MonthlyDisplayRow[] = response.items.map((item) => ({
        monthLabel: monthLabel(lang, item.record.year, item.record.monthNum),
        incomeEur: item.record.incomeEur,
        spendingEur: item.record.spendingEur,
        netEur: item.record.netChangeEur,
        closed: item.record.signedOffAt !== null,
      }));

      const netEur = current.netChangeEur;

      return {
        currentNetFormatted: formatSignedEur(netEur),
        currentNetTone: netEur >= 0 ? "gain" : "loss",
        currentIncomeFormatted: `+${eur0.format(current.incomeEur)}`,
        currentSpendingFormatted: `−${eur0.format(current.spendingEur)}`,
        months,
        monthKeys: response.items.map((item) => ({
          year: item.record.year,
          monthNum: item.record.monthNum,
        })),
        current,
      };
    },
  });
}

export interface MobilePortfolioClassSummary {
  label: string;
  amountEur: number;
  pct: number;
}

export interface MobilePortfolioViewData {
  totalValueFormatted: string;
  pnlFormatted: string;
  pnlTone?: "gain" | "loss";
  classes: MobilePortfolioClassSummary[];
  holdings: HoldingCardItem[];
  /** Holding ids, same order as `holdings`. */
  holdingIds: string[];
  accountOptions: MobileSelectOption[];
}

const PREVIEW_PORTFOLIO_DATA: MobilePortfolioViewData = {
  totalValueFormatted: "85 900 €",
  pnlFormatted: "+12 450 €",
  pnlTone: "gain",
  classes: [
    { label: "ETF", amountEur: 62000, pct: 0.72 },
    { label: "Actions", amountEur: 14900, pct: 0.17 },
    { label: "Crypto", amountEur: 9000, pct: 0.11 },
  ],
  holdings: [
    {
      ticker: "CW8.PA",
      label: "Amundi MSCI World",
      account: "PEA",
      kind: "etf",
      quantity: 120,
      pricePerUnit: 516.67,
      marketValueEur: 62000,
      pnlEur: 9800,
      pnlPct: 18.8,
    },
  ],
  holdingIds: ["hld_previewCW8000000000000"],
  accountOptions: [{ value: "acc_previewPEA00000000000", label: "PEA" }],
};

export function useMobilePortfolioData() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();

  return useQuery<MobilePortfolioViewData>({
    queryKey: [...mobileQueryKeys.portfolio(), isAuthenticated, lang],
    queryFn: async () => {
      if (!isAuthenticated) {
        return {
          ...PREVIEW_PORTFOLIO_DATA,
          classes: PREVIEW_PORTFOLIO_DATA.classes.map((c, i) => ({
            ...c,
            label: t(
              (
                [
                  "common.assetClasses.etf",
                  "common.assetClasses.action",
                  "common.assetClasses.crypto",
                ] as const
              )[i] ?? "common.assetClasses.etf",
            ),
          })),
        };
      }

      const [holdingsList, accountsList] = await Promise.all([
        holdingsClient.list({ includeClosed: false }),
        accountsClient.list(),
      ]);

      const accountLabelById = new Map(accountsList.map((a) => [a.id, a.label]));

      let totalMarketValue = 0;
      let totalCost = 0;
      const byKind: Record<HoldingKind, number> = {
        etf: 0,
        action: 0,
        crypto: 0,
        autre: 0,
      };

      const holdings: HoldingCardItem[] = holdingsList.map((h) => {
        const unitPrice = h.lastPrice > 0 ? h.lastPrice : h.avgCost;
        const marketValueEur = h.quantity * unitPrice;
        const costEur = h.quantity * h.avgCost;
        const pnlEur = marketValueEur - costEur;
        const pnlPct = h.avgCost > 0 ? ((unitPrice - h.avgCost) / h.avgCost) * 100 : 0;

        totalMarketValue += marketValueEur;
        totalCost += costEur;
        byKind[h.kind] += marketValueEur;

        return {
          ticker: h.ticker ?? h.label.slice(0, 8).toUpperCase(),
          label: h.label,
          account: accountLabelById.get(h.accountId) ?? t("common.fallback.portfolio"),
          kind: h.kind,
          quantity: h.quantity,
          pricePerUnit: unitPrice,
          marketValueEur,
          pnlEur,
          pnlPct,
        };
      });

      const totalPnl = totalMarketValue - totalCost;
      const safeTotal = Math.max(1, totalMarketValue);

      const classes: MobilePortfolioClassSummary[] = [
        { label: t("common.assetClasses.etf"), amountEur: byKind.etf, pct: byKind.etf / safeTotal },
        {
          label: t("common.assetClasses.action"),
          amountEur: byKind.action,
          pct: byKind.action / safeTotal,
        },
        {
          label: t("common.assetClasses.crypto"),
          amountEur: byKind.crypto,
          pct: byKind.crypto / safeTotal,
        },
      ];

      return {
        totalValueFormatted: eur0.format(totalMarketValue),
        pnlFormatted: formatSignedEur(totalPnl),
        pnlTone: totalPnl >= 0 ? "gain" : "loss",
        classes,
        holdings,
        holdingIds: holdingsList.map((h) => h.id),
        accountOptions: accountsList.map((a) => ({ value: a.id, label: a.label })),
      };
    },
  });
}

export interface MobileRealEstateViewData {
  totalEquityFormatted: string;
  totalValuationFormatted: string;
  totalDebtFormatted: string;
  properties: PropertyCardItem[];
  /** Property ids, same order as `properties`. */
  propertyIds: string[];
}

const PREVIEW_REALESTATE_DATA: MobileRealEstateViewData = {
  totalEquityFormatted: "70 000 €",
  totalValuationFormatted: "250 000 €",
  totalDebtFormatted: "180 000 €",
  properties: [
    {
      label: "Appartement Lyon 7e",
      valuationEur: 250000,
      debtRemainingEur: 180000,
      monthlyPaymentEur: 890,
      yearsRemaining: 18,
      repaidPct: 0.28,
    },
  ],
  propertyIds: ["res_previewLyon7e0000000"],
};

export function useMobileRealEstateData() {
  const { isAuthenticated } = useAuth();

  return useQuery<MobileRealEstateViewData>({
    queryKey: [...mobileQueryKeys.realestate(), isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) {
        return PREVIEW_REALESTATE_DATA;
      }

      const [propertiesList, derivesList, totalEquity] = await Promise.all([
        realestateClient.listProperties(),
        realestateClient.listPropertyDerives(),
        realestateClient.getTotalEquity(),
      ]);

      const deriveById = new Map(derivesList.map((d) => [d.propertyId, d]));

      let totalValuation = 0;
      let totalDebt = 0;

      const properties: PropertyCardItem[] = propertiesList.map((prop) => {
        const derive = deriveById.get(prop.id);
        const netEquity = derive?.netEquityEur ?? prop.currentValuation;
        const debtRemainingEur = Math.max(0, prop.currentValuation - netEquity);
        const repaidPct =
          prop.currentValuation > 0
            ? Math.max(0, Math.min(1, netEquity / prop.currentValuation))
            : 1;

        totalValuation += prop.currentValuation;
        totalDebt += debtRemainingEur;

        return {
          label: prop.label,
          valuationEur: prop.currentValuation,
          debtRemainingEur,
          monthlyPaymentEur: 0,
          yearsRemaining: 0,
          repaidPct,
        };
      });

      return {
        totalEquityFormatted: eur0.format(totalEquity.totalEquityEur),
        totalValuationFormatted: eur0.format(totalValuation),
        totalDebtFormatted: eur0.format(totalDebt),
        properties,
        propertyIds: propertiesList.map((p) => p.id),
      };
    },
  });
}

/** Property with its mortgage / rental, for the attach-vs-update sheets. */
export function useMobilePropertyDetail(propertyId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...mobileQueryKeys.property(propertyId), isAuthenticated],
    enabled: isAuthenticated && Boolean(propertyId),
    queryFn: async () => await realestateClient.getProperty({ id: propertyId ?? "" }),
  });
}

export function useMobileValuations(propertyId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...mobileQueryKeys.valuations(propertyId), isAuthenticated],
    enabled: isAuthenticated && Boolean(propertyId),
    queryFn: async () => await realestateClient.listValuations({ propertyId: propertyId ?? "" }),
  });
}

/** Current compass (objective + horizon) for the Paramètres edit sheet. */
export function useMobileCompassData() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...mobileQueryKeys.compass(), isAuthenticated],
    queryFn: async () =>
      isAuthenticated ? await compassClient.getCompass() : { objectif: 800000, horizonYears: 30 },
  });
}

export interface MobileSettingsData {
  theme: ThemePref;
  lang: LangPref;
}

const PREVIEW_SETTINGS_DATA: MobileSettingsData = {
  theme: "system",
  lang: "fr",
};

export function useMobileSettingsData() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<MobileSettingsData>({
    queryKey: [...mobileQueryKeys.settings(), isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) {
        return PREVIEW_SETTINGS_DATA;
      }
      return await settingsClient.get();
    },
  });

  const updateThemeMutation = useMutation({
    mutationFn: async (theme: ThemePref) => {
      if (!isAuthenticated) {
        return { ...(query.data ?? PREVIEW_SETTINGS_DATA), theme };
      }
      return await settingsClient.updateTheme({ theme });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([...mobileQueryKeys.settings(), isAuthenticated], updated);
    },
  });

  const updateLangMutation = useMutation({
    mutationFn: async (lang: LangPref) => {
      if (!isAuthenticated) {
        return { ...(query.data ?? PREVIEW_SETTINGS_DATA), lang };
      }
      return await settingsClient.updateLang({ lang });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([...mobileQueryKeys.settings(), isAuthenticated], updated);
    },
  });

  return {
    prefs: query.data ?? PREVIEW_SETTINGS_DATA,
    isLoading: query.isLoading,
    updateTheme: updateThemeMutation.mutateAsync,
    updateLang: updateLangMutation.mutateAsync,
  };
}
