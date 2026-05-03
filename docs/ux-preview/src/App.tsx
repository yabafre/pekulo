import { useState, useEffect, createContext, useContext } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  COMPASS,
  MILESTONES,
  WEALTH,
  USER,
  TODAY,
  TRANSACTIONS,
  ACCOUNTS,
  HOLDINGS,
  PROPERTIES,
  MONTHLY,
  LLM_LOG,
  HYPOTHESIS,
} from "./data/mock";
import {
  formatEUR,
  formatPct,
  formatCompactEUR,
  formatDate,
  formatMonthYear,
  signed,
} from "./lib/format";
import { cn } from "./lib/cn";
import {
  Compass,
  ChevronDown,
  Plus,
  Check,
  Receipt,
  LineChart,
  Wallet,
  Building2,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search,
  Globe,
  Moon,
  Sun,
  Monitor,
  Download,
  Trash2,
  LogOut,
  Bot,
} from "lucide-react";

type NavKey = "cap" | "transactions" | "monthly" | "portfolio" | "realestate" | "settings";
type TopTab = "cap" | "patrimoine";
type Theme = "system" | "dark" | "light";

/**
 * Theme context — lifted to App so SettingsScreen can toggle it
 * and the <html> classList gets updated for tailwind's `.light` variant.
 */
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function useTheme() {
  return useContext(ThemeContext);
}

/** Apply the correct class on <html> when theme or system preference changes. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const effective = theme === "system" ? (prefersLight ? "light" : "dark") : theme;
  root.classList.toggle("light", effective === "light");
  root.style.colorScheme = effective;
}

const NAV: Array<{ key: NavKey; label: string; icon: typeof Compass }> = [
  { key: "cap", label: "Cap", icon: Compass },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "monthly", label: "Mensuel", icon: LineChart },
  { key: "portfolio", label: "Portefeuille", icon: Wallet },
  { key: "realestate", label: "Immobilier", icon: Building2 },
];

const SCREEN_TITLE: Record<NavKey, string> = {
  cap: "Cap",
  transactions: "Transactions",
  monthly: "Mensuel",
  portfolio: "Portefeuille",
  realestate: "Immobilier",
  settings: "Paramètres",
};

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>("cap");
  const [topTab, setTopTab] = useState<TopTab>("cap");
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="min-h-dvh bg-bg text-fg-secondary font-sans antialiased">
        {/* Floating sidebar bubble (lg+ only) */}
        <NavRail activeKey={activeNav} setActiveKey={setActiveNav} />

        {/* Main shell — leaves room for the sidebar bubble on lg+ */}
        <div className="flex flex-col min-h-dvh lg:pl-24 lg:pr-4">
          {/* Mobile-only top bar */}
          <header className="lg:hidden flex items-center justify-between px-5 pt-6 pb-2">
            {activeNav === "cap" ? (
              <TopTabToggle topTab={topTab} setTopTab={setTopTab} />
            ) : (
              <h1 className="text-body-lg lg:text-h1 font-semibold text-fg leading-none">
                {SCREEN_TITLE[activeNav]}
              </h1>
            )}
            <div className="flex items-center gap-2">
              <ContextualAddButton activeNav={activeNav} />
              <UserDot onClick={() => setActiveNav("settings")} />
            </div>
          </header>

          {/* Desktop top bar */}
          <header className="hidden lg:flex lg:items-center lg:justify-between lg:px-2 lg:pt-6 lg:pb-2">
            <div className="flex items-center gap-6">
              <p className="text-caption text-fg-tertiary">{formatDate(TODAY)}</p>
              {activeNav === "cap" ? (
                <TopTabToggle topTab={topTab} setTopTab={setTopTab} />
              ) : (
                <h1 className="text-body-lg lg:text-h1 font-semibold text-fg leading-none">
                  {SCREEN_TITLE[activeNav]}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveNav("transactions")}
                className="flex items-center gap-2 h-10 px-4 rounded-full bg-fg text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={16} strokeWidth={2.25} aria-hidden /> Nouvelle transaction
              </button>
              <UserDot onClick={() => setActiveNav("settings")} />
            </div>
          </header>

          <main id="main" className="flex-1 px-5 pt-6 pb-28 lg:px-2 lg:pt-4 lg:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${activeNav}-${activeNav === "cap" ? topTab : "x"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeNav === "cap" && (topTab === "cap" ? <CapView /> : <PatrimoineView />)}
                {activeNav === "transactions" && <TransactionsScreen />}
                {activeNav === "monthly" && <MonthlyScreen />}
                {activeNav === "portfolio" && <PortfolioScreen />}
                {activeNav === "realestate" && <RealEstateScreen />}
                {activeNav === "settings" && <SettingsScreen />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile bottom nav — 5 icons, TR-grade minimal */}
          <nav
            aria-label="Navigation principale"
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-bg"
          >
            <ul className="mx-auto max-w-md grid grid-cols-5 px-2 pt-2 pb-5">
              {NAV.map((item) => (
                <li key={item.key}>
                  <button
                    onClick={() => setActiveNav(item.key)}
                    aria-label={item.label}
                    aria-current={activeNav === item.key ? "page" : undefined}
                    className={cn(
                      "w-full flex flex-col items-center justify-center gap-1 py-2 rounded-md transition-colors",
                      activeNav === item.key ? "text-fg" : "text-fg-tertiary",
                    )}
                  >
                    <item.icon size={20} strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] leading-none">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

/* ──────────────────────────  Sidebar bubble (lg+)  ────────────────────────── */

function NavRail({
  activeKey,
  setActiveKey,
}: {
  activeKey: NavKey;
  setActiveKey: (k: NavKey) => void;
}) {
  return (
    <aside
      aria-label="Navigation principale"
      className="hidden lg:flex lg:fixed lg:left-4 lg:top-4 lg:bottom-4 lg:w-16 lg:flex-col lg:items-center lg:gap-1 lg:bg-card lg:rounded-xl lg:py-4 z-40"
    >
      <button
        onClick={() => setActiveKey("cap")}
        aria-label="Pekulo — accueil"
        className="grid h-10 w-10 place-items-center rounded-lg text-fg"
      >
        <Compass size={22} strokeWidth={2} aria-hidden />
      </button>
      <span className="my-2 h-px w-8 bg-border" />

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveKey(item.key)}
            aria-label={item.label}
            aria-current={activeKey === item.key ? "page" : undefined}
            className={cn(
              "group relative grid h-10 w-10 place-items-center rounded-lg transition-colors",
              activeKey === item.key
                ? "bg-elevated text-fg"
                : "text-fg-tertiary hover:text-fg hover:bg-muted",
            )}
          >
            <item.icon size={18} strokeWidth={1.75} aria-hidden />
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-elevated text-fg text-caption whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        onClick={() => setActiveKey("settings")}
        aria-label="Paramètres"
        aria-current={activeKey === "settings" ? "page" : undefined}
        className={cn(
          "grid h-10 w-10 place-items-center rounded-lg transition-colors",
          activeKey === "settings"
            ? "bg-elevated text-fg"
            : "text-fg-tertiary hover:text-fg hover:bg-muted",
        )}
      >
        <Settings size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </aside>
  );
}

function UserDot({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Compte de ${USER.displayName}`}
      className="grid h-11 w-11 lg:h-10 lg:w-10 place-items-center rounded-full bg-muted text-body-sm font-medium text-fg"
    >
      {USER.displayName.charAt(0)}
    </button>
  );
}

/** Mobile-only primary "+" button shown on screens that support a primary add action. */
function ContextualAddButton({ activeNav }: { activeNav: NavKey }) {
  const labelMap: Partial<Record<NavKey, string>> = {
    transactions: "Nouvelle transaction",
    portfolio: "Nouvelle ligne",
    realestate: "Nouveau bien",
  };
  const label = labelMap[activeNav];
  if (!label) return null;
  return (
    <button
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full bg-fg text-bg"
    >
      <Plus size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
}

function TopTabToggle({ topTab, setTopTab }: { topTab: TopTab; setTopTab: (t: TopTab) => void }) {
  return (
    <div className="flex items-baseline gap-3 leading-none">
      <button
        onClick={() => setTopTab("cap")}
        aria-pressed={topTab === "cap"}
        className={cn(
          "text-h2 lg:text-h1 transition-colors",
          topTab === "cap" ? "text-fg" : "text-fg-muted hover:text-fg-tertiary",
        )}
      >
        Cap
      </button>
      <button
        onClick={() => setTopTab("patrimoine")}
        aria-pressed={topTab === "patrimoine"}
        className={cn(
          "text-h2 lg:text-h1 transition-colors",
          topTab === "patrimoine" ? "text-fg" : "text-fg-muted hover:text-fg-tertiary",
        )}
      >
        Patrimoine
      </button>
    </div>
  );
}

/* ──────────────────────────  Cap view  ────────────────────────── */

function CapView() {
  return (
    <>
      {/* Mobile: single-column stack */}
      <div className="lg:hidden flex flex-col gap-10">
        <HeroBlock variant="mobile" />
        <MiniKpis />
        <TrajectorySection />
        <MilestonesSection />
        <HypothesisSection />
        <CompositionSection />
        <RecentActivitySection />
      </div>

      {/* Desktop: bento grid */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:auto-rows-[minmax(112px,auto)] lg:gap-4">
        <HeroCard className="lg:col-span-7 lg:row-span-2" />
        <DonutCard className="lg:col-span-5 lg:row-span-2" />
        <TrajectoryCard className="lg:col-span-7 lg:row-span-2" />
        <MilestonesCard className="lg:col-span-5 lg:row-span-2" />
        <CompositionCard className="lg:col-span-5" />
        <RecentActivityCard className="lg:col-span-7" />
        <HypothesisCard className="lg:col-span-12" />
      </div>
    </>
  );
}

function PatrimoineView() {
  return (
    <div className="flex flex-col gap-10 lg:max-w-3xl lg:mx-auto">
      <section>
        <p className="text-caption text-fg-tertiary">Total</p>
        <p className="mt-2 text-h1 lg:text-hero tabular-nums text-fg">
          {formatEUR(WEALTH.totalEur)}
        </p>
        <p className="mt-2 text-body-sm text-fg-tertiary tabular-nums">
          {formatCompactEUR(WEALTH.cashEur)} liquide · {formatCompactEUR(WEALTH.holdingsEur)} placé
          · {formatCompactEUR(WEALTH.realEstateEur)} immobilier
        </p>
      </section>
      <AccountsSection />
      <CompositionSection />
      <RecentActivitySection />
    </div>
  );
}

/* ──────────────────────────  Mobile sections  ────────────────────────── */

function HeroBlock({ variant }: { variant: "mobile" | "card" }) {
  const ahead = WEALTH.totalEur - WEALTH.curve12m[0].plan;
  return (
    <section aria-label="Patrimoine total">
      <p className="text-caption text-fg-tertiary">
        {variant === "mobile" ? "Aujourd'hui" : "Patrimoine total"}
      </p>
      <p className="mt-2 text-h1 lg:text-hero tabular-nums text-fg">
        <CountUpEUR value={WEALTH.totalEur} />
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-body-sm tabular-nums">
        <span className="text-gain font-medium">+{formatEUR(ahead)}</span>
        <span className="text-fg-tertiary">vs plan · 12 mois</span>
      </p>
      {variant === "card" && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <dt className="text-caption text-fg-tertiary">Cap</dt>
              <dd className="text-body lg:text-h2 tabular-nums text-fg mt-1 font-semibold">
                {formatEUR(COMPASS.targetCapital)}
              </dd>
              <dd className="text-caption text-fg-tertiary">en {COMPASS.targetYear}</dd>
            </div>
            <div>
              <dt className="text-caption text-fg-tertiary">Plan / an</dt>
              <dd className="text-body lg:text-h2 tabular-nums text-fg mt-1 font-semibold">
                {formatCompactEUR(WEALTH.required12mEur)}
              </dd>
              <dd className="text-caption text-fg-tertiary">linéaire</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

function MiniKpis() {
  const pct = WEALTH.progressRatio;
  const remaining = COMPASS.targetCapital - WEALTH.totalEur;
  const yearsLeft = COMPASS.targetYear - new Date(TODAY).getFullYear();
  return (
    <section className="grid grid-cols-3 gap-3">
      <KpiTile
        label="Cap"
        valueTop={`${(pct * 100).toFixed(1)} %`}
        valueBottom={`${formatCompactEUR(remaining)} restants`}
        progress={pct}
      />
      <KpiTile
        label="Horizon"
        valueTop={`${COMPASS.targetYear}`}
        valueBottom={`${yearsLeft} ans`}
      />
      <KpiTile
        label="Plan / an"
        valueTop={formatCompactEUR(WEALTH.required12mEur)}
        valueBottom="linéaire"
      />
    </section>
  );
}

function TrajectorySection() {
  return (
    <section aria-labelledby="traj-h">
      <header className="flex items-center justify-between mb-5">
        <h2 id="traj-h" className="text-h3 lg:text-h2 text-fg">
          Trajectoire
        </h2>
        <HeaderAction label="12 mois" iconRight={ChevronDown} />
      </header>
      <TrajectoryChart inCard={false} />
    </section>
  );
}

function MilestonesSection() {
  return (
    <section aria-labelledby="ms-h">
      <header className="flex items-center justify-between mb-3">
        <h2 id="ms-h" className="text-h3 lg:text-h2 text-fg">
          Paliers
        </h2>
        <HeaderAction icon={Plus} label="Ajouter" />
      </header>
      <StaggerList>
        {MILESTONES.map((m) => (
          <li key={m.id}>
            <MilestoneRow milestone={m} />
          </li>
        ))}
      </StaggerList>
    </section>
  );
}

/**
 * Reusable stagger list — each direct <li> child fades up with 40ms delay.
 * Honours prefers-reduced-motion (renders instantly, no transform).
 */
function StaggerList({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      className={cn("flex flex-col", className)}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: reduce ? 0 : 0.04, delayChildren: reduce ? 0 : 0.05 },
        },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div
              key={(child as { key?: React.Key })?.key ?? i}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 8 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              {child}
            </motion.div>
          ))
        : children}
    </motion.ul>
  );
}

function CompositionSection() {
  const slices = compositionSlices();
  return (
    <section aria-labelledby="comp-h">
      <h2 id="comp-h" className="text-h3 lg:text-h2 text-fg mb-3">
        Composition
      </h2>
      <ul className="flex flex-col">
        {slices.map((s) => (
          <li key={s.label}>
            <CompositionRow {...s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentActivitySection() {
  const recent = TRANSACTIONS.slice(0, 5);
  return (
    <section aria-labelledby="act-h">
      <header className="flex items-center justify-between mb-3">
        <h2 id="act-h" className="text-h3 lg:text-h2 text-fg">
          Activité récente
        </h2>
        <HeaderAction label="Voir tout" />
      </header>
      <ul className="flex flex-col">
        {recent.map((tx) => (
          <li key={tx.id}>
            <ActivityRow tx={tx} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ──────────────────────────  Accounts (used in Patrimoine view)  ────────────────────────── */

function AccountsSection() {
  const totalCash = ACCOUNTS.reduce((s, a) => s + a.cashBalance, 0);
  return (
    <section aria-labelledby="acc-h">
      <header className="flex items-center justify-between mb-3">
        <h2 id="acc-h" className="text-h3 lg:text-h2 text-fg">
          Comptes
        </h2>
        <HeaderAction icon={Plus} label="Ajouter" />
      </header>
      <ul className="flex flex-col">
        {ACCOUNTS.map((a) => (
          <li key={a.id}>
            <AccountRow account={a} />
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-3 border-t border-border flex items-center justify-between">
        <p className="text-caption text-fg-tertiary uppercase tracking-wider">Total liquide</p>
        <p className="text-body-sm tabular-nums text-fg font-medium">{formatEUR(totalCash)}</p>
      </div>
    </section>
  );
}

function AccountRow({ account }: { account: (typeof ACCOUNTS)[number] }) {
  const typeLabel: Record<typeof account.type, string> = {
    livret: "Livret",
    pea: "PEA",
    cto: "CTO",
    av: "Assurance-vie",
    autre: "Compte courant",
  };
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg font-medium truncate">{account.label}</p>
        <p className="text-caption text-fg-tertiary truncate">
          {typeLabel[account.type]} · {account.institution}
        </p>
      </div>
      <p className="text-body-sm tabular-nums text-fg shrink-0">{formatEUR(account.cashBalance)}</p>
    </div>
  );
}

/* ──────────────────────────  Hypothesis projection (Cap dashboard)  ────────────────────────── */

function HypothesisSection() {
  return (
    <section aria-labelledby="hyp-h">
      <header className="flex items-center justify-between mb-3">
        <h2 id="hyp-h" className="text-h3 lg:text-h2 text-fg">
          Hypothèse
        </h2>
        <span className="text-caption text-fg-tertiary tabular-nums shrink-0">
          {formatEUR(HYPOTHESIS.monthlyContributionEur)} / mois ·{" "}
          {HYPOTHESIS.assumedAnnualRatePct.toFixed(1)} % / an
        </span>
      </header>
      <ProjectionChart />
      <HypothesisVerdict />
    </section>
  );
}

function HypothesisCard({ className }: { className?: string }) {
  return (
    <Section
      className={className}
      ariaLabel="Hypothèse de projection"
      title="Hypothèse"
      action={
        <span className="text-caption text-fg-tertiary tabular-nums shrink-0">
          {formatEUR(HYPOTHESIS.monthlyContributionEur)} / mois ·{" "}
          {HYPOTHESIS.assumedAnnualRatePct.toFixed(1)} % / an
        </span>
      }
    >
      <ProjectionChart />
      <HypothesisVerdict />
    </Section>
  );
}

function HypothesisVerdict() {
  const last = HYPOTHESIS.curve[HYPOTHESIS.curve.length - 1];
  const gap = last.projected - last.required;
  const exceeds = gap >= 0;
  return (
    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 flex-wrap">
      <p className="text-body-sm text-fg-secondary">
        {exceeds
          ? `À ${HYPOTHESIS.monthlyContributionEur.toLocaleString("fr-FR")} € / mois et ${HYPOTHESIS.assumedAnnualRatePct.toFixed(1)} %, vous dépassez le cap.`
          : `À ce rythme, il manque ${formatEUR(HYPOTHESIS.monthlyShortfallEur)} / mois pour atteindre le cap.`}
      </p>
      <div className="text-right tabular-nums shrink-0">
        <p className={cn("text-body-sm font-medium", exceeds ? "text-gain" : "text-loss")}>
          {exceeds ? "+" : "−"}
          {formatEUR(Math.abs(gap))}
        </p>
        <p className="text-caption text-fg-tertiary">au cap {COMPASS.targetYear}</p>
      </div>
    </div>
  );
}

function ProjectionChart() {
  const w = 700;
  const h = 200;
  const padX = 12;
  const padY = 18;
  const series = HYPOTHESIS.curve;
  const minY = 0;
  const maxY = Math.max(...series.flatMap((p) => [p.projected, p.required])) * 1.05;
  const xStep = (w - padX * 2) / (series.length - 1);
  const yScale = (v: number) => padY + (1 - (v - minY) / (maxY - minY)) * (h - padY * 2);

  const toPath = (key: "projected" | "required") =>
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${yScale(p[key])}`).join(" ");

  const last = series[series.length - 1];
  const lastX = padX + (series.length - 1) * xStep;
  const lastYProj = yScale(last.projected);
  const lastYReq = yScale(last.required);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Projection patrimoine versus cap requis"
      >
        <line
          x1={padX}
          y1={h - padY}
          x2={w - padX}
          y2={h - padY}
          stroke="var(--chart-grid)"
          strokeWidth="1"
        />
        <path
          d={toPath("required")}
          fill="none"
          stroke="var(--chart-plan)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d={toPath("projected")}
          fill="none"
          stroke="var(--chart-actual)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastYProj} r="4" fill="var(--chart-actual)" />
        <circle
          cx={lastX}
          cy={lastYReq}
          r="3"
          fill="none"
          stroke="var(--chart-plan)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between flex-wrap gap-2 text-caption text-fg-tertiary">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-px bg-fg" /> Projection
          <span className="inline-block w-3 h-px border-t border-dashed border-fg-tertiary ml-3" />{" "}
          Cap requis
        </span>
        <span className="tabular-nums">
          {series[0].date.split("-")[0]} → {series[series.length - 1].date.split("-")[0]}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────  Desktop bento cards  ────────────────────────── */

function HeroCard({ className }: { className?: string }) {
  return (
    <Section className={className} ariaLabel="Patrimoine et cap">
      <HeroBlock variant="card" />
    </Section>
  );
}

function DonutCard({ className }: { className?: string }) {
  const pct = WEALTH.progressRatio;
  const remaining = COMPASS.targetCapital - WEALTH.totalEur;
  const ahead = WEALTH.totalEur - WEALTH.curve12m[0].plan;
  return (
    <Section className={className} ariaLabel="Progression du cap">
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <Donut pct={pct} size={208} stroke={6} centered />
        <div>
          <p className="text-caption text-fg-tertiary">Restant</p>
          <p className="mt-1 text-body lg:text-h2 tabular-nums text-fg font-semibold">
            {formatEUR(remaining)}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-body-sm tabular-nums">
            <span className="text-gain font-medium">+{formatEUR(ahead)}</span>
            <span className="text-fg-tertiary">vs plan</span>
          </p>
        </div>
      </div>
    </Section>
  );
}

function TrajectoryCard({ className }: { className?: string }) {
  return (
    <Section
      className={className}
      ariaLabel="Trajectoire 12 mois"
      title="Trajectoire"
      action={<HeaderAction label="12 mois" iconRight={ChevronDown} />}
    >
      <TrajectoryChart inCard={false} tall />
    </Section>
  );
}

/**
 * Single Section component used by every bento cell + mobile section.
 * Same gray (`bg-card #0A0A0A`), same radius, same alignment as the sidebar bubble.
 * Padding tighter on mobile to reduce visual weight.
 */
function Section({
  className,
  ariaLabel,
  title,
  action,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className={cn("rounded-xl bg-card p-5 lg:p-6", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between mb-4 gap-2">
          {title ? <h2 className="text-h3 lg:text-h2 text-fg">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Count-up animation for monetary values — Framer Motion spring on mount.
 * Respects prefers-reduced-motion (renders final value immediately).
 */
function CountUpEUR({
  value,
  className,
  precise,
}: {
  value: number;
  className?: string;
  precise?: boolean;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22, mass: 0.9 });
  const display = useTransform(spring, (v) => formatEUR(Math.round(v), { precise }));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    mv.set(0);
    const t = window.requestAnimationFrame(() => mv.set(value));
    return () => window.cancelAnimationFrame(t);
  }, [value, mv, reduce]);

  return <motion.span className={className}>{display}</motion.span>;
}

/** Loading skeleton — shimmer-free flat block matching TR minimalism. */
export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-3 rounded-sm bg-muted animate-pulse"
          style={{ width: `${85 - i * 12}%` }}
        />
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

/** Empty state — illustration-free icon + message + CTA, used for first-run / no-results. */
function EmptyState({
  icon: Icon,
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon: typeof Compass;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-fg-tertiary mb-4">
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-body-sm text-fg font-medium mb-1">{title}</h3>
      <p className="text-caption text-fg-tertiary max-w-xs">{message}</p>
      {ctaLabel && (
        <button
          onClick={onCta}
          className="mt-5 flex items-center gap-2 h-10 px-4 rounded-full bg-fg text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2.25} aria-hidden /> {ctaLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Unified pill button for inline section actions (Ajouter / Filtrer / Voir tout / 12 mois).
 * Always visible: bg-muted + white text, hover bumps to elevated.
 */
function HeaderAction({
  icon: Icon,
  iconRight,
  label,
  onClick,
}: {
  icon?: typeof Compass;
  iconRight?: typeof Compass;
  label: string;
  onClick?: () => void;
}) {
  const RightIcon = iconRight;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted text-fg text-caption font-medium hover:bg-elevated transition-colors shrink-0"
    >
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
      {label}
      {RightIcon && <RightIcon size={12} strokeWidth={2.25} aria-hidden />}
    </button>
  );
}

function MilestonesCard({ className }: { className?: string }) {
  return (
    <Section
      className={className}
      ariaLabel="Paliers"
      title="Paliers"
      action={<HeaderAction icon={Plus} label="Ajouter" />}
    >
      <ul className="flex flex-col">
        {MILESTONES.map((m) => (
          <li key={m.id}>
            <MilestoneRow milestone={m} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CompositionCard({ className }: { className?: string }) {
  const slices = compositionSlices();
  return (
    <Section className={className} ariaLabel="Composition du patrimoine" title="Composition">
      <ul className="flex flex-col">
        {slices.map((s) => (
          <li key={s.label}>
            <CompositionRow {...s} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RecentActivityCard({ className }: { className?: string }) {
  const recent = TRANSACTIONS.slice(0, 5);
  return (
    <Section
      className={className}
      ariaLabel="Activité récente"
      title="Activité récente"
      action={<HeaderAction label="Voir tout" />}
    >
      <ul className="flex flex-col">
        {recent.map((tx) => (
          <li key={tx.id}>
            <ActivityRow tx={tx} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ──────────────────────────  Atoms  ────────────────────────── */

function KpiTile({
  label,
  valueTop,
  valueBottom,
  progress,
}: {
  label: string;
  valueTop: string;
  valueBottom: string;
  progress?: number;
}) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-start justify-between">
        <p className="text-caption text-fg-tertiary">{label}</p>
        {progress !== undefined && <Donut pct={progress} size={22} stroke={2.5} />}
      </div>
      <p className="text-h3 tabular-nums text-fg mt-auto">{valueTop}</p>
      <p className="text-caption text-fg-tertiary tabular-nums">{valueBottom}</p>
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: (typeof MILESTONES)[number] }) {
  const linearPlanForYear =
    WEALTH.totalEur +
    (milestone.targetYear - new Date(TODAY).getFullYear()) * WEALTH.required12mEur;
  const planRatio = Math.min(linearPlanForYear / milestone.targetCapital, 1);
  const deltaCls =
    milestone.status === "ahead"
      ? "text-gain"
      : milestone.status === "behind"
        ? "text-loss"
        : "text-neutral";

  return (
    <div className="flex items-center gap-4 py-3">
      <Donut pct={planRatio} size={36} stroke={3} />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg font-medium truncate">
          {milestone.label.replace(/^[^—]*— /, "")}
        </p>
        <p className="text-caption text-fg-tertiary tabular-nums">
          {formatEUR(milestone.targetCapital)} · {milestone.targetYear}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-body-sm tabular-nums font-medium", deltaCls)}>
          {milestone.deltaEur >= 0 ? "+" : ""}
          {formatEUR(milestone.deltaEur)}
        </p>
        <p className="text-caption text-fg-tertiary">
          {milestone.status === "ahead"
            ? "en avance"
            : milestone.status === "behind"
              ? "en retard"
              : "sur la trajectoire"}
        </p>
      </div>
    </div>
  );
}

function CompositionRow({
  label,
  amount,
  pct,
  sub,
}: {
  label: string;
  amount: number;
  pct: number;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <Donut pct={pct} size={28} stroke={2.5} />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg font-medium">{label}</p>
        {sub && <p className="text-caption text-fg-tertiary tabular-nums">{sub}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-body-sm tabular-nums text-fg">{formatEUR(amount)}</p>
        <p className="text-caption text-fg-tertiary tabular-nums">{(pct * 100).toFixed(0)} %</p>
      </div>
    </div>
  );
}

function ActivityRow({ tx }: { tx: (typeof TRANSACTIONS)[number] }) {
  const isInflow = tx.type === "inflow";
  const isTransfer = tx.type === "transfer";
  const account = ACCOUNTS.find((a) => a.id === tx.accountId);
  const Icon = isInflow ? ArrowDownRight : ArrowUpRight;
  const sign = isInflow ? "+" : isTransfer ? "↔ " : "";
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon
        size={18}
        strokeWidth={2}
        aria-hidden
        className={cn(isInflow ? "text-gain" : "text-fg-tertiary")}
      />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg truncate">{tx.label}</p>
        <p className="text-caption text-fg-tertiary truncate">
          {account?.label}
          {tx.suggestedCategory && !tx.confirmed && (
            <span className="ml-2 text-fg-muted">· IA : {tx.suggestedCategory}</span>
          )}
          {tx.category && tx.confirmed && (
            <span className="ml-2 text-fg-muted">· {tx.category}</span>
          )}
        </p>
      </div>
      <p
        className={cn(
          "text-body-sm tabular-nums shrink-0 font-medium",
          isInflow ? "text-gain" : "text-fg",
        )}
      >
        {sign}
        {formatEUR(tx.amountEur)}
      </p>
    </div>
  );
}

/** TR-style donut: white stroke on dim track, no gradient, no color. Animated sweep on mount. */
function Donut({
  pct,
  size,
  stroke,
  centered,
}: {
  pct: number;
  size: number;
  stroke: number;
  centered?: boolean;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div
      className={cn("relative inline-block", centered && "mx-auto")}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${formatPct(pct)} atteint`}
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--donut-track)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--donut-fill)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? target : c }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      {centered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-display tabular-nums text-fg leading-none">
            <CountUpPct value={pct} />
          </span>
          <span className="mt-1 text-caption text-fg-tertiary">de votre cap</span>
        </div>
      )}
    </div>
  );
}

/** Count-up animation for percentage values, mirrors CountUpEUR. */
function CountUpPct({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22, mass: 0.9 });
  const display = useTransform(spring, (v) => `${(v * 100).toFixed(1)}%`);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    mv.set(0);
    const t = window.requestAnimationFrame(() => mv.set(value));
    return () => window.cancelAnimationFrame(t);
  }, [value, mv, reduce]);
  return <motion.span>{display}</motion.span>;
}

function TrajectoryChart({ inCard, tall }: { inCard: boolean; tall?: boolean }) {
  const w = 600;
  const h = tall ? 220 : 180;
  const padX = 12;
  const padY = 18;
  const series = WEALTH.curve12m;
  const minY = Math.min(...series.flatMap((p) => [p.actual, p.plan])) - 1500;
  const maxY = Math.max(...series.flatMap((p) => [p.actual, p.plan])) + 1500;
  const xStep = (w - padX * 2) / (series.length - 1);
  const yScale = (v: number) => padY + (1 - (v - minY) / (maxY - minY)) * (h - padY * 2);

  const toPath = (key: "actual" | "plan") =>
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${yScale(p[key])}`).join(" ");

  const last = series[series.length - 1];
  const lastX = padX + (series.length - 1) * xStep;
  const lastY = yScale(last.actual);

  const Inner = (
    <>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Trajectoire patrimoine 12 mois"
      >
        <line
          x1={padX}
          y1={h / 2}
          x2={w - padX}
          y2={h / 2}
          stroke="var(--chart-grid)"
          strokeWidth="1"
        />
        <path
          d={toPath("plan")}
          fill="none"
          stroke="var(--chart-plan)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d={toPath("actual")}
          fill="none"
          stroke="var(--chart-actual)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r="4" fill="var(--chart-actual)" />
      </svg>
      <div className="mt-3 flex items-center gap-5 text-caption text-fg-tertiary">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-px bg-fg" /> Réel
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-px border-t border-dashed border-fg-tertiary" /> Plan
        </span>
      </div>
    </>
  );
  return <div className={inCard ? "rounded-xl bg-card p-4" : ""}>{Inner}</div>;
}

/* ──────────────────────────  Helpers  ────────────────────────── */

function compositionSlices() {
  return [
    {
      label: "Liquide",
      sub: "Livret + courant",
      amount: WEALTH.cashEur,
      pct: WEALTH.cashEur / WEALTH.totalEur,
    },
    {
      label: "Placements",
      sub: "PEA + CTO + AV",
      amount: WEALTH.holdingsEur,
      pct: WEALTH.holdingsEur / WEALTH.totalEur,
    },
    {
      label: "Immobilier",
      sub: "Lyon 7e — net equity",
      amount: WEALTH.realEstateEur,
      pct: WEALTH.realEstateEur / WEALTH.totalEur,
    },
  ];
}

/* ════════════════════════════════════════════════════════════════════════
   TRANSACTIONS SCREEN — J4 (LLM auto-categorisation)
   ════════════════════════════════════════════════════════════════════════ */

function TransactionsScreen() {
  const pending = TRANSACTIONS.filter((t) => !t.confirmed && t.suggestedCategory);
  const confirmed = TRANSACTIONS.filter((t) => t.confirmed);
  const totalInflow = TRANSACTIONS.filter((t) => t.type === "inflow").reduce(
    (s, t) => s + t.amountEur,
    0,
  );
  const totalOutflow = TRANSACTIONS.filter((t) => t.type === "outflow").reduce(
    (s, t) => s + Math.abs(t.amountEur),
    0,
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-4">
      {/* Stat row — 2 cards on mobile (essential), 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Section ariaLabel="Net du mois">
          <p className="text-caption text-fg-tertiary">Net · mai</p>
          <p
            className={cn(
              "mt-2 text-h2 tabular-nums",
              totalInflow - totalOutflow >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {signed(totalInflow - totalOutflow)}
          </p>
        </Section>
        <Section ariaLabel="En attente IA">
          <p className="text-caption text-fg-tertiary">À confirmer</p>
          <p className="mt-2 flex items-baseline gap-2 text-h2 tabular-nums text-fg">
            {pending.length}
            <span className="text-caption text-fg-tertiary font-normal">suggestions</span>
          </p>
        </Section>
        <Section ariaLabel="Entrées du mois" className="hidden lg:block">
          <p className="text-caption text-fg-tertiary">Entrées · mai</p>
          <p className="mt-2 text-body lg:text-h2 tabular-nums text-fg font-semibold">
            {formatEUR(totalInflow)}
          </p>
        </Section>
        <Section ariaLabel="Sorties du mois" className="hidden lg:block">
          <p className="text-caption text-fg-tertiary">Sorties · mai</p>
          <p className="mt-2 text-body lg:text-h2 tabular-nums text-fg font-semibold">
            {formatEUR(totalOutflow)}
          </p>
        </Section>
      </div>

      {/* IA suggestions */}
      <Section
        ariaLabel="Suggestions IA"
        title="Suggestions IA"
        action={
          <span className="flex items-center gap-1.5 text-caption text-fg-tertiary tabular-nums shrink-0">
            <Bot size={12} strokeWidth={2} aria-hidden /> {pending.length} à valider
          </span>
        }
      >
        {pending.length === 0 ? (
          <EmptyState
            icon={Check}
            title="Tout est catégorisé"
            message="Vos nouvelles transactions apparaîtront ici dès qu'elles seront importées."
          />
        ) : (
          <ul className="flex flex-col">
            {pending.map((tx) => (
              <li key={tx.id}>
                <SuggestionRow tx={tx} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Confirmed list */}
      <Section
        ariaLabel="Récentes"
        title="Récentes"
        action={<HeaderAction icon={Search} label="Filtrer" />}
      >
        <ul className="flex flex-col">
          {confirmed.map((tx) => (
            <li key={tx.id}>
              <ActivityRow tx={tx} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function SuggestionRow({ tx }: { tx: (typeof TRANSACTIONS)[number] }) {
  const account = ACCOUNTS.find((a) => a.id === tx.accountId);
  const Icon = tx.type === "inflow" ? ArrowDownRight : ArrowUpRight;
  const confidencePct = Math.round((tx.suggestionConfidence ?? 0) * 100);
  const lowConfidence = (tx.suggestionConfidence ?? 0) < 0.75;
  const routeLabel = {
    "foundation-models": "iOS",
    ollama: "Ollama",
    "third-party": "Cloud",
    "rule-transfer": "Règle",
  }[tx.llmRoute ?? "ollama"];

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon
        size={18}
        strokeWidth={2}
        aria-hidden
        className={cn("mt-0.5", tx.type === "inflow" ? "text-gain" : "text-fg-tertiary")}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm text-fg truncate">{tx.label}</p>
            <p className="text-caption text-fg-tertiary truncate">
              {account?.label} · {formatDate(tx.occurredOn)}
            </p>
          </div>
          <p
            className={cn(
              "text-body-sm tabular-nums shrink-0 font-medium",
              tx.type === "inflow" ? "text-gain" : "text-fg",
            )}
          >
            {tx.type === "inflow" ? "+" : ""}
            {formatEUR(tx.amountEur)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1 text-caption text-fg">
            <Sparkles size={11} strokeWidth={2} aria-hidden /> {tx.suggestedCategory}
          </span>
          <span
            className={cn(
              "text-caption tabular-nums",
              lowConfidence ? "text-warning" : "text-fg-tertiary",
            )}
          >
            {confidencePct}%<span className="hidden sm:inline"> · {routeLabel}</span>
          </span>
          <button
            aria-label="Confirmer la suggestion"
            className="ml-auto flex items-center gap-1 rounded-md bg-fg text-bg px-2.5 py-1 text-caption font-medium hover:opacity-90 transition-opacity"
          >
            <Check size={12} strokeWidth={2.5} aria-hidden /> Confirmer
          </button>
          <button
            aria-label="Modifier la catégorie"
            className="text-caption text-fg-tertiary hover:text-fg px-2 py-1"
          >
            Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PORTFOLIO SCREEN — J5 (holdings + lots)
   ════════════════════════════════════════════════════════════════════════ */

function PortfolioScreen() {
  const total = HOLDINGS.reduce((s, h) => s + h.marketValueEur, 0);
  const totalPnl = HOLDINGS.reduce((s, h) => s + h.unrealizedPnlEur, 0);
  const totalPnlPct = totalPnl / (total - totalPnl);
  const byKind = {
    etf: HOLDINGS.filter((h) => h.kind === "etf").reduce((s, h) => s + h.marketValueEur, 0),
    action: HOLDINGS.filter((h) => h.kind === "action").reduce((s, h) => s + h.marketValueEur, 0),
    crypto: HOLDINGS.filter((h) => h.kind === "crypto").reduce((s, h) => s + h.marketValueEur, 0),
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Section ariaLabel="Valeur totale" className="lg:col-span-7">
          <p className="text-caption text-fg-tertiary">Valeur portefeuille · EUR</p>
          <p className="mt-2 text-h1 lg:text-hero tabular-nums text-fg">{formatEUR(total)}</p>
          <p className="mt-2 flex items-center gap-1.5 text-body-sm tabular-nums">
            <span className={cn("font-medium", totalPnl >= 0 ? "text-gain" : "text-loss")}>
              {signed(totalPnl)}
            </span>
            <span className="text-fg-tertiary">
              ({totalPnl >= 0 ? "+" : ""}
              {(totalPnlPct * 100).toFixed(2)} %) plus-value latente
            </span>
          </p>
        </Section>

        <Section ariaLabel="Répartition par classe" className="lg:col-span-5">
          <p className="text-caption text-fg-tertiary mb-3">Répartition</p>
          <ul className="flex flex-col">
            <ClassRow label="ETF" amount={byKind.etf} pct={byKind.etf / total} />
            <ClassRow label="Actions" amount={byKind.action} pct={byKind.action / total} />
            <ClassRow label="Crypto" amount={byKind.crypto} pct={byKind.crypto / total} />
          </ul>
        </Section>
      </div>

      <Section
        ariaLabel="Lignes"
        title="Lignes"
        action={<HeaderAction icon={Plus} label="Ajouter" />}
      >
        <ul className="flex flex-col">
          {HOLDINGS.map((h) => (
            <li key={h.id}>
              <HoldingRow holding={h} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ClassRow({ label, amount, pct }: { label: string; amount: number; pct: number }) {
  return (
    <li className="flex items-center gap-4 py-2.5">
      <Donut pct={pct} size={24} stroke={2.5} />
      <p className="text-body-sm text-fg flex-1">{label}</p>
      <p className="text-body-sm tabular-nums text-fg shrink-0">{formatEUR(amount)}</p>
      <p className="text-caption tabular-nums text-fg-tertiary shrink-0 w-10 text-right">
        {(pct * 100).toFixed(0)} %
      </p>
    </li>
  );
}

function HoldingRow({ holding }: { holding: (typeof HOLDINGS)[number] }) {
  const account = ACCOUNTS.find((a) => a.id === holding.accountId);
  const isGain = holding.unrealizedPnlEur >= 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-body-sm text-fg font-medium truncate">{holding.ticker}</p>
          <span className="text-[11px] text-fg-muted uppercase tracking-wider shrink-0">
            {holding.kind}
          </span>
        </div>
        <p className="text-caption text-fg-tertiary truncate tabular-nums">
          {holding.label} · {account?.label}
        </p>
        <p className="hidden lg:block text-caption text-fg-muted tabular-nums">
          {holding.quantity} × {formatEUR(holding.currentPrice, { precise: true })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-body-sm tabular-nums text-fg font-medium">
          {formatEUR(holding.marketValueEur)}
        </p>
        <p className={cn("text-caption tabular-nums", isGain ? "text-gain" : "text-loss")}>
          {signed(holding.unrealizedPnlEur)} ({(holding.unrealizedPnlPct * 100).toFixed(2)} %)
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MONTHLY SCREEN — J3 (monthly closing)
   ════════════════════════════════════════════════════════════════════════ */

function MonthlyScreen() {
  const current = MONTHLY[0];
  const past = MONTHLY.slice(1);
  return (
    <div className="flex flex-col gap-6 lg:gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Section ariaLabel="Mois en cours" className="lg:col-span-7">
          <p className="text-caption text-fg-tertiary">
            {formatMonthYear(`${current.yearMonth}-15`)} · en cours
          </p>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <Stat label="Entrées" value={formatEUR(current.incomeEur)} />
            <Stat label="Sorties" value={formatEUR(current.spendingEur)} />
            <Stat
              label="Net"
              value={signed(current.netEur)}
              tone={current.netEur >= 0 ? "gain" : "loss"}
            />
          </div>
        </Section>
        <Section ariaLabel="Action" className="lg:col-span-5">
          <p className="text-caption text-fg-tertiary">Clôture</p>
          <p className="mt-2 text-body-sm text-fg">
            Le mois en cours sera clôturable une fois toutes les transactions catégorisées.
          </p>
          <button className="mt-4 flex items-center gap-2 h-10 px-4 rounded-full bg-muted text-fg text-body-sm font-medium opacity-50 cursor-not-allowed">
            <Check size={14} strokeWidth={2} aria-hidden /> Clôturer mai
          </button>
        </Section>
      </div>

      <Section ariaLabel="Mois passés" title="Historique">
        <ul className="flex flex-col">
          {past.map((m) => (
            <li key={m.yearMonth}>
              <MonthlyRow month={m} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="text-caption text-fg-tertiary">{label}</p>
      <p
        className={cn(
          "mt-1 text-h3 tabular-nums",
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MonthlyRow({ month }: { month: (typeof MONTHLY)[number] }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg capitalize">
          {formatMonthYear(`${month.yearMonth}-15`)}
        </p>
        <p className="text-caption text-fg-tertiary tabular-nums">
          {formatEUR(month.incomeEur)} entrées · {formatEUR(month.spendingEur)} sorties
        </p>
      </div>
      <p
        className={cn(
          "text-body-sm tabular-nums shrink-0 font-medium",
          month.netEur >= 0 ? "text-gain" : "text-loss",
        )}
      >
        {signed(month.netEur)}
      </p>
      {month.signedOff && (
        <span className="shrink-0 inline-flex items-center gap-1 text-caption text-fg-tertiary">
          <Check size={12} strokeWidth={2} aria-hidden /> Clôturé
        </span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   REAL ESTATE SCREEN — J6 (real estate tracker)
   ════════════════════════════════════════════════════════════════════════ */

function RealEstateScreen() {
  const totalValuation = PROPERTIES.reduce((s, p) => s + p.currentValuationEur, 0);
  const totalEquity = PROPERTIES.reduce((s, p) => s + p.netEquityEur, 0);
  const totalDebt = totalValuation - totalEquity;

  return (
    <div className="flex flex-col gap-6 lg:gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Section ariaLabel="Net equity total" className="lg:col-span-7">
          <p className="text-caption text-fg-tertiary">Equity nette · EUR</p>
          <p className="mt-2 text-h1 lg:text-hero tabular-nums text-fg">{formatEUR(totalEquity)}</p>
          <p className="mt-2 text-body-sm text-fg-tertiary tabular-nums">
            {formatEUR(totalValuation)} valorisation · {formatEUR(totalDebt)} dette restante
          </p>
        </Section>
        <Section ariaLabel="Action" className="lg:col-span-5">
          <p className="text-caption text-fg-tertiary">Portefeuille immobilier</p>
          <p className="mt-2 text-body lg:text-h2 tabular-nums text-fg font-semibold">
            {PROPERTIES.length} bien
          </p>
          <button className="mt-4 flex items-center gap-2 h-10 px-4 rounded-full bg-fg text-bg text-body-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={14} strokeWidth={2.5} aria-hidden /> Ajouter un bien
          </button>
        </Section>
      </div>

      {PROPERTIES.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}

function PropertyCard({ property }: { property: (typeof PROPERTIES)[number] }) {
  const m = property.mortgage;
  const equityRatio = property.netEquityEur / property.currentValuationEur;
  return (
    <Section
      ariaLabel={property.label}
      title={property.label}
      action={
        <span className="text-caption text-fg-tertiary uppercase tracking-wider shrink-0">
          {property.type === "residence-principale" ? "Résidence principale" : property.type}
        </span>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        <div className="flex flex-col gap-3">
          <Stat label="Valorisation" value={formatEUR(property.currentValuationEur)} />
          <Stat label="Equity nette" value={formatEUR(property.netEquityEur)} tone="gain" />
          <p className="text-caption text-fg-tertiary tabular-nums">
            Valorisé le {formatDate(property.lastValuedAt)}
          </p>
        </div>
        {m && (
          <div className="flex flex-col gap-3">
            <p className="text-caption text-fg-tertiary uppercase tracking-wider">Crédit</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Capital restant" value={formatEUR(m.outstandingPrincipalEur)} />
              <Stat label="Mensualité" value={formatEUR(m.monthlyPaymentEur)} />
              <Stat label="Taux" value={`${m.annualRatePct.toFixed(2)} %`} />
              <Stat
                label="Reste"
                value={`${Math.floor(m.termRemainingMonths / 12)} ans ${m.termRemainingMonths % 12} m`}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center gap-3">
          <Donut pct={equityRatio} size={28} stroke={2.5} />
          <p className="text-body-sm text-fg-tertiary tabular-nums">
            <span className="text-fg font-medium">{(equityRatio * 100).toFixed(0)} %</span>{" "}
            remboursé du capital initial
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS SCREEN — J auth + theme + LLM opt-in + data export
   ════════════════════════════════════════════════════════════════════════ */

function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [thirdPartyLLM, setThirdPartyLLM] = useState(USER.thirdPartyLLMOptIn);

  return (
    <div className="flex flex-col gap-6 lg:gap-4 lg:max-w-3xl">
      {/* Account */}
      <Section ariaLabel="Compte" title="Compte">
        <ul className="flex flex-col">
          <SettingRow label="Email" value={USER.email} />
          <SettingRow label="Nom affiché" value={USER.displayName} action="Modifier" />
        </ul>
      </Section>

      {/* Apparence */}
      <Section ariaLabel="Apparence" title="Apparence">
        <p className="text-caption text-fg-tertiary mb-3">Thème</p>
        <SegmentedControl
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "Système", icon: Monitor },
            { value: "dark", label: "Sombre", icon: Moon },
            { value: "light", label: "Clair", icon: Sun },
          ]}
        />

        <p className="mt-6 text-caption text-fg-tertiary mb-3">Langue</p>
        <SegmentedControl
          value={lang}
          onChange={setLang}
          options={[
            { value: "fr", label: "Français", icon: Globe },
            { value: "en", label: "English", icon: Globe },
          ]}
        />
      </Section>

      {/* AI */}
      <Section ariaLabel="Intelligence artificielle" title="Intelligence artificielle">
        <p className="text-body-sm text-fg-secondary mb-4">
          Pekulo catégorise vos transactions automatiquement. Les modèles tournent par défaut sur
          votre appareil (Apple Intelligence) ou notre serveur privé (Ollama). Aucune donnée ne
          quitte ce périmètre sauf si vous activez explicitement les modèles tiers ci-dessous.
        </p>
        <ToggleRow
          label="Autoriser les modèles tiers (Claude / Mistral)"
          sub="Pour les cas ambigus uniquement. Le label, le montant, la date et le marchand sont envoyés. Aucun identifiant ni numéro de compte."
          checked={thirdPartyLLM}
          onChange={setThirdPartyLLM}
        />
        <button className="mt-4 text-body-sm text-fg-tertiary hover:text-fg">
          Voir le journal d'activité IA ({LLM_LOG.length} derniers appels) →
        </button>
      </Section>

      {/* Data */}
      <Section ariaLabel="Vos données" title="Vos données">
        <ul className="flex flex-col">
          <SettingRow
            label="Exporter mes données"
            sub="JSON complet · conforme RGPD"
            action={
              <>
                <Download size={14} strokeWidth={2} aria-hidden /> Exporter
              </>
            }
          />
          <SettingRow
            label="Supprimer mon compte"
            sub="Cascade sur toutes les tables · irréversible"
            destructive
            action={
              <>
                <Trash2 size={14} strokeWidth={2} aria-hidden /> Supprimer
              </>
            }
          />
        </ul>
      </Section>

      {/* Session */}
      <Section ariaLabel="Session">
        <button className="flex items-center gap-2 text-body-sm text-fg-tertiary hover:text-fg">
          <LogOut size={14} strokeWidth={2} aria-hidden /> Se déconnecter
        </button>
      </Section>

      {/* Hypothesis context */}
      <Section ariaLabel="Hypothèse" title="Hypothèse de projection">
        <ul className="flex flex-col">
          <SettingRow
            label="Versement mensuel"
            value={formatEUR(HYPOTHESIS.monthlyContributionEur)}
          />
          <SettingRow
            label="Rendement annuel supposé"
            value={`${HYPOTHESIS.assumedAnnualRatePct.toFixed(2)} %`}
          />
        </ul>
      </Section>
    </div>
  );
}

function SettingRow({
  label,
  value,
  sub,
  action,
  destructive,
}: {
  label: string;
  value?: string;
  sub?: string;
  action?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className={cn("text-body-sm", destructive ? "text-loss" : "text-fg")}>{label}</p>
        {sub && <p className="text-caption text-fg-tertiary">{sub}</p>}
        {value && !sub && (
          <p className="text-caption text-fg-tertiary tabular-nums truncate">{value}</p>
        )}
      </div>
      {action && (
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium transition-colors shrink-0",
            destructive ? "text-loss hover:bg-loss-soft" : "bg-muted text-fg hover:bg-elevated",
          )}
        >
          {action}
        </button>
      )}
    </li>
  );
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-fg">{label}</p>
        {sub && <p className="text-caption text-fg-tertiary mt-1">{sub}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 mt-0.5 inline-flex items-center h-6 w-11 rounded-full transition-colors",
          checked ? "bg-fg" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full transition-transform",
            checked ? "translate-x-5 bg-bg" : "translate-x-0.5 bg-fg-tertiary",
          )}
        />
      </button>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon: typeof Compass }>;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-full text-body-sm transition-colors",
              active ? "bg-bg text-fg" : "text-fg-tertiary hover:text-fg",
            )}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden /> {opt.label}
          </button>
        );
      })}
    </div>
  );
}
