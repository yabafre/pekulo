// packages/ui/src/parity/cases.tsx
// Story 10-5 — the shared web ↔ native parity catalog. One entry per render
// to compare; exactly one `golden: true` entry per component is captured as
// an iOS screenshot golden by the Maestro ds-gallery flow.
//
// Platform-agnostic by construction: components are imported from their
// folders (Metro / Jest / TS moduleSuffixes resolve the `.native.tsx`
// siblings on React Native), icons come from ./icons (split per platform),
// children use Tamagui `Text`, and callbacks are no-ops. NEVER import from
// "lucide-react", "react-dom", or HTML elements here.
//
// NOT re-exported from src/index.ts / src/index.native.ts — consumed only via
// the `@pekulo/ui/parity` subpath (tests + the mobile DS gallery).
import type { ReactElement } from "react";
import { Text } from "tamagui";

import { CategoryIcon } from "../components/CategoryIcon";
import { CategoryPicker } from "../components/CategoryPicker";
import { PekuloAccountRow } from "../components/PekuloAccountRow";
import { PekuloAccountsSection } from "../components/PekuloAccountsSection";
import { PekuloActivityRow } from "../components/PekuloActivityRow";
import { PekuloClassRow } from "../components/PekuloClassRow";
import { PekuloCompositionCard } from "../components/PekuloCompositionCard";
import { PekuloCompositionRow } from "../components/PekuloCompositionRow";
import { PekuloContextualAddButton } from "../components/PekuloContextualAddButton";
import { PekuloCountUpEUR } from "../components/PekuloCountUpEUR";
import { PekuloCountUpPct } from "../components/PekuloCountUpPct";
import { PekuloDonut } from "../components/PekuloDonut";
import { PekuloDonutCard } from "../components/PekuloDonutCard";
import { PekuloEmptyState } from "../components/PekuloEmptyState";
import { PekuloErrorBoundary } from "../components/PekuloErrorBoundary";
import { PekuloHero } from "../components/PekuloHero";
import { PekuloHeroCard } from "../components/PekuloHeroCard";
import { PekuloHoldingRow } from "../components/PekuloHoldingRow";
import { PekuloHypothesisCard } from "../components/PekuloHypothesisCard";
import { PekuloHypothesisVerdict } from "../components/PekuloHypothesisVerdict";
import { PekuloKpiTile } from "../components/PekuloKpiTile";
import { PekuloMilestoneRow } from "../components/PekuloMilestoneRow";
import { PekuloMilestonesCard } from "../components/PekuloMilestonesCard";
import { PekuloMobileBottomNav } from "../components/PekuloMobileBottomNav";
import { PekuloMonthlyRow } from "../components/PekuloMonthlyRow";
import { PekuloNavRail } from "../components/PekuloNavRail";
import { PekuloPagination } from "../components/PekuloPagination";
import { PekuloProjectionChart } from "../components/PekuloProjectionChart";
import { PekuloPropertyCard } from "../components/PekuloPropertyCard";
import { PekuloRecentActivityCard } from "../components/PekuloRecentActivityCard";
import { PekuloSegmentedControl } from "../components/PekuloSegmentedControl";
import { PekuloSettingRow } from "../components/PekuloSettingRow";
import { PekuloSkeleton } from "../components/PekuloSkeleton";
import { PekuloStaggerList } from "../components/PekuloStaggerList";
import { PekuloStat } from "../components/PekuloStat";
import { PekuloSuggestionRow } from "../components/PekuloSuggestionRow";
import { PekuloToggleRow } from "../components/PekuloToggleRow";
import { PekuloTopTabToggle } from "../components/PekuloTopTabToggle";
import { PekuloTrajectoryCard } from "../components/PekuloTrajectoryCard";
import { PekuloTrajectoryChart } from "../components/PekuloTrajectoryChart";
import { PekuloUserDot } from "../components/PekuloUserDot";
import { TransactionLogo } from "../components/TransactionLogo";
import { Check, Monitor, Moon, Sun } from "./icons";
import type { ParityCase } from "./types";

const noop = (): void => {};

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Throws on render so PekuloErrorBoundary shows its default fallback. */
function ParityBoom(): never {
  throw new Error("kaboom");
}

function parityCase(
  component: string,
  variant: string,
  golden: boolean,
  render: () => ReactElement,
): ParityCase {
  return { id: `${component}.${variant}`, component, golden, render };
}

/**
 * Components deliberately left out of the catalog, with the reason. An entry
 * here is a reviewed decision, never a convenience (same rule as
 * ds-coverage.meta.test.ts). Empty at story 10-5: all 42 are covered.
 */
export const PARITY_EXEMPT_COMPONENTS: Record<string, string> = {};

export const PARITY_CASES: readonly ParityCase[] = [
  parityCase("CategoryIcon", "known", true, () => <CategoryIcon category="courses" />),
  parityCase("CategoryPicker", "closed", true, () => (
    <CategoryPicker
      value="courses"
      onValueChange={noop}
      options={[
        { value: "courses", label: "Courses" },
        { value: "transport", label: "Transport" },
        { value: "restauration", label: "Restauration" },
      ]}
    />
  )),
  parityCase("PekuloAccountRow", "default", true, () => (
    <PekuloAccountRow label="PEA Bourso" type="pea" institution="Boursorama" balanceEur={45200} />
  )),
  parityCase("PekuloAccountsSection", "three", true, () => (
    <PekuloAccountsSection
      accounts={[
        { label: "Livret A", type: "livret", institution: "Bourso", balanceEur: 15000 },
        { label: "PEA Bourso", type: "pea", institution: "Boursorama", balanceEur: 45200 },
        { label: "CTO", type: "cto", balanceEur: 12000 },
      ]}
    />
  )),
  parityCase("PekuloActivityRow", "inflow", true, () => (
    <PekuloActivityRow
      tx={{
        label: "Salaire",
        account: "Compte courant",
        category: "Revenus",
        direction: "in",
        amountEur: 3200,
      }}
    />
  )),
  parityCase("PekuloActivityRow", "outflow", false, () => (
    <PekuloActivityRow
      tx={{
        label: "Carrefour",
        account: "CB",
        category: "Courses",
        direction: "out",
        amountEur: 87,
      }}
    />
  )),
  parityCase("PekuloClassRow", "default", true, () => (
    <PekuloClassRow label="ETF" amountEur={62000} pct={0.55} />
  )),
  parityCase("PekuloCompositionCard", "three", true, () => (
    <PekuloCompositionCard
      items={[
        { id: "etf", label: "ETF", amount: 92400, pct: 0.51, sub: "Marchés mondiaux" },
        { id: "crypto", label: "Crypto", amount: 12800, pct: 0.07 },
        { id: "cash", label: "Cash", amount: 41200, pct: 0.23 },
      ]}
    />
  )),
  parityCase("PekuloCompositionRow", "withSub", true, () => (
    <PekuloCompositionRow
      label="Placements"
      amount={89000}
      pct={0.49}
      sub="ETF + Actions + Crypto"
    />
  )),
  parityCase("PekuloContextualAddButton", "default", true, () => (
    <PekuloContextualAddButton label="Ajouter une transaction" onPress={noop} />
  )),
  parityCase("PekuloCountUpEUR", "integer", true, () => <PekuloCountUpEUR value={180400} />),
  parityCase("PekuloCountUpEUR", "precise", false, () => (
    <PekuloCountUpEUR value={87.42} precise />
  )),
  parityCase("PekuloCountUpPct", "default", true, () => <PekuloCountUpPct value={0.42} />),
  parityCase("PekuloCountUpPct", "precise", false, () => (
    <PekuloCountUpPct value={0.728} precise />
  )),
  parityCase("PekuloDonut", "plain", false, () => <PekuloDonut pct={0.5} />),
  parityCase("PekuloDonut", "centered", true, () => <PekuloDonut pct={0.72} centered />),
  parityCase("PekuloDonutCard", "default", true, () => (
    <PekuloDonutCard title="Compass" pct={0.42} centered />
  )),
  parityCase("PekuloEmptyState", "withCta", true, () => (
    <PekuloEmptyState
      icon={Check}
      title="Pas de cap"
      message="Définis un cap pour commencer."
      ctaLabel="Définir un cap"
      onCta={noop}
    />
  )),
  parityCase("PekuloEmptyState", "noCta", false, () => (
    <PekuloEmptyState
      icon={Check}
      title="Tout est catégorisé"
      message="Aucune transaction en attente."
    />
  )),
  parityCase("PekuloErrorBoundary", "fallback", true, () => (
    <PekuloErrorBoundary>
      <ParityBoom />
    </PekuloErrorBoundary>
  )),
  parityCase("PekuloHero", "mobile", true, () => <PekuloHero totalEur={180400} aheadEur={21383} />),
  parityCase("PekuloHero", "card", false, () => (
    <PekuloHero
      variant="card"
      totalEur={180400}
      aheadEur={21383}
      targetCapital={800000}
      targetYear={2055}
      requiredYearlyEur={21383}
    />
  )),
  parityCase("PekuloHero", "negative", false, () => (
    <PekuloHero totalEur={140000} aheadEur={-5000} />
  )),
  parityCase("PekuloHeroCard", "default", true, () => (
    <PekuloHeroCard
      totalEur={180400}
      aheadEur={2400}
      targetCapital={500000}
      targetYear={2055}
      requiredYearlyEur={21400}
    />
  )),
  parityCase("PekuloHoldingRow", "gain", true, () => (
    <PekuloHoldingRow
      holding={{
        ticker: "CW8.PA",
        label: "MSCI World",
        account: "PEA",
        kind: "etf",
        quantity: 142,
        pricePerUnit: 532.5,
        marketValueEur: 75615,
        pnlEur: 8420,
        pnlPct: 12.5,
      }}
    />
  )),
  parityCase("PekuloHoldingRow", "loss", false, () => (
    <PekuloHoldingRow
      holding={{
        ticker: "BTC",
        label: "Bitcoin",
        account: "Crypto.com",
        kind: "crypto",
        quantity: 0.45,
        pricePerUnit: 56000,
        marketValueEur: 25200,
        pnlEur: -3800,
        pnlPct: -13.1,
      }}
    />
  )),
  parityCase("PekuloHypothesisCard", "reaches", true, () => (
    <PekuloHypothesisCard
      reaches
      headline="Tu atteins ton cap en 2055."
      deltaLabel={`+${eur0.format(20000)} vs cap requis`}
    />
  )),
  parityCase("PekuloHypothesisVerdict", "reaches", true, () => (
    <PekuloHypothesisVerdict
      reaches
      headline="Tu atteins ton cap en 2055."
      deltaLabel={`+${eur0.format(20000)} vs cap requis`}
    />
  )),
  parityCase("PekuloHypothesisVerdict", "gap", false, () => (
    <PekuloHypothesisVerdict
      reaches={false}
      headline="Tu n'atteins pas ton cap en 2055."
      deltaLabel={`−${eur0.format(150000)} vs cap requis`}
      gapLabel={`Il manque ${eur0.format(120)} / mois pour atteindre le cap.`}
    />
  )),
  parityCase("PekuloKpiTile", "text", true, () => (
    <PekuloKpiTile label="Cap" valueTop="22%" valueBottom="objectif 2055" />
  )),
  parityCase("PekuloKpiTile", "donut", false, () => (
    <PekuloKpiTile label="Cap" valueTop="22%" progress={0.22} />
  )),
  parityCase("PekuloMilestoneRow", "ahead", true, () => (
    <PekuloMilestoneRow
      milestone={{
        label: "1er palier",
        targetEur: 50000,
        targetYear: 2030,
        progressPct: 0.55,
        deltaEur: 1500,
        status: "ahead",
      }}
    />
  )),
  parityCase("PekuloMilestoneRow", "behind", false, () => (
    <PekuloMilestoneRow
      milestone={{
        label: "2e palier",
        targetEur: 100000,
        targetYear: 2035,
        progressPct: 0.2,
        deltaEur: -2300,
        status: "behind",
      }}
    />
  )),
  parityCase("PekuloMilestonesCard", "two", true, () => (
    <PekuloMilestonesCard
      milestones={[
        {
          label: "Apport résidence principale",
          targetEur: 60000,
          targetYear: 2030,
          progressPct: 0.4,
          deltaEur: 1200,
          status: "ahead",
        },
        {
          label: "Liberté financière",
          targetEur: 500000,
          targetYear: 2055,
          progressPct: 0.18,
          deltaEur: -3400,
          status: "behind",
        },
      ]}
    />
  )),
  parityCase("PekuloMobileBottomNav", "cap", true, () => (
    <PekuloMobileBottomNav activeKey="cap" onSelect={noop} />
  )),
  parityCase("PekuloMonthlyRow", "openPositive", true, () => (
    <PekuloMonthlyRow
      month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }}
    />
  )),
  parityCase("PekuloNavRail", "cap", true, () => <PekuloNavRail activeKey="cap" onSelect={noop} />),
  parityCase("PekuloPagination", "mid", true, () => (
    <PekuloPagination page={3} pageCount={7} onPageChange={noop} />
  )),
  parityCase("PekuloProjectionChart", "default", true, () => (
    <PekuloProjectionChart
      years={[2026, 2030, 2040, 2055]}
      actual={[180, 250, 400, 650]}
      required={[180, 260, 420, 800]}
      nowMarker={{ year: 2026, value: 180 }}
      capMarker={{ year: 2055, value: 800 }}
    />
  )),
  parityCase("PekuloPropertyCard", "default", true, () => (
    <PekuloPropertyCard
      property={{
        label: "Appartement Lyon",
        valuationEur: 320000,
        debtRemainingEur: 180000,
        monthlyPaymentEur: 1240,
        yearsRemaining: 18,
        repaidPct: 0.31,
      }}
    />
  )),
  parityCase("PekuloRecentActivityCard", "two", true, () => (
    <PekuloRecentActivityCard
      activities={[
        {
          label: "Salaire",
          account: "CB Bourso",
          category: "Revenus",
          direction: "in",
          amountEur: 3200,
        },
        {
          label: "Carrefour",
          account: "CB Bourso",
          category: "Courses",
          direction: "out",
          amountEur: 87,
        },
      ]}
    />
  )),
  parityCase("PekuloSegmentedControl", "theme", true, () => (
    <PekuloSegmentedControl<"system" | "dark" | "light">
      value="dark"
      onChange={noop}
      ariaLabel="Thème"
      options={[
        { value: "system", label: "Système", icon: Monitor },
        { value: "dark", label: "Sombre", icon: Moon },
        { value: "light", label: "Clair", icon: Sun },
      ]}
    />
  )),
  parityCase("PekuloSettingRow", "default", true, () => (
    <PekuloSettingRow label="Email" value="alex@example.fr" />
  )),
  parityCase("PekuloSettingRow", "destructive", false, () => (
    <PekuloSettingRow label="Supprimer le compte" sub="Action irréversible" destructive />
  )),
  parityCase("PekuloSkeleton", "lines", true, () => <PekuloSkeleton lines={3} />),
  parityCase("PekuloStaggerList", "three", true, () => (
    <PekuloStaggerList ariaLabel="paliers">
      <Text>Apport</Text>
      <Text>Indep</Text>
      <Text>Liberté</Text>
    </PekuloStaggerList>
  )),
  parityCase("PekuloStat", "neutral", false, () => <PekuloStat label="Net" value="+1 050 €" />),
  parityCase("PekuloStat", "gain", true, () => (
    <PekuloStat label="Net" value="+1 050 €" tone="gain" />
  )),
  parityCase("PekuloSuggestionRow", "pending", true, () => (
    <PekuloSuggestionRow
      tx={{
        label: "Carrefour",
        account: "CB Bourso",
        dateLabel: "12 mai",
        direction: "out",
        amountEur: 87,
        suggestedCategory: "Courses",
        confidence: 0.91,
        route: "ios",
      }}
      onConfirm={noop}
      onEdit={noop}
    />
  )),
  parityCase("PekuloSuggestionRow", "lowConfidence", false, () => (
    <PekuloSuggestionRow
      tx={{
        label: "AMZN MKTPL",
        account: "CB",
        dateLabel: "10 mai",
        direction: "out",
        amountEur: 42,
        suggestedCategory: "Maison",
        confidence: 0.62,
        route: "ollama",
      }}
      onConfirm={noop}
      onEdit={noop}
    />
  )),
  parityCase("PekuloToggleRow", "unchecked", true, () => (
    <PekuloToggleRow
      label="LLM tiers"
      sub="Activer le routage cloud"
      checked={false}
      onChange={noop}
    />
  )),
  parityCase("PekuloToggleRow", "checked", false, () => (
    <PekuloToggleRow label="LLM tiers" checked onChange={noop} />
  )),
  parityCase("PekuloTopTabToggle", "cap", true, () => (
    <PekuloTopTabToggle topTab="cap" onChange={noop} />
  )),
  parityCase("PekuloTrajectoryCard", "default", true, () => (
    <PekuloTrajectoryCard
      months={[0, 3, 6, 9, 12]}
      actual={[100, 105, 112, 118, 124]}
      plan={[100, 104, 108, 112, 116]}
    />
  )),
  parityCase("PekuloTrajectoryChart", "default", true, () => (
    <PekuloTrajectoryChart
      months={[1, 2, 3, 4, 5, 6]}
      actual={[100, 110, 115, 123, 130, 140]}
      plan={[100, 108, 116, 124, 132, 140]}
    />
  )),
  parityCase("PekuloUserDot", "initial", true, () => <PekuloUserDot initial="a" />),
  parityCase("TransactionLogo", "categoryFallback", true, () => (
    <TransactionLogo category="courses" />
  )),
];
