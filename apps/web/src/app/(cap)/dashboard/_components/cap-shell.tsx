"use client";

// apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx
//
// Client wrapper that holds the Cap-view chrome (sidebar nav + topbar)
// around the bento page content. Mirrors ux-preview App.tsx:114-203
// verbatim.
//
// Responsive switch is shared between `bento.module.css`
// (`@media (min-width: 1024px)`) and the DS components:
// `PekuloNavRail` hides via `$max-lg = { display: "none" }` (i.e. < 1024)
// and `PekuloMobileBottomNav` hides via `$lg = { display: "none" }` (≥
// 1024). All three pivot at 1024 px = Tamagui v5 `lg`, so the rail / bottom-
// nav / shell-padding flip atomically. (Pre-2026-05-17 the rail used
// `$max-md` claiming Tamagui `md = 1020`; see lesson 2026-05-17 "Tamagui
// v5 media keys" — the real `md` is 768 and the right cutover is 1024.)

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PekuloContextualAddButton,
  PekuloMobileBottomNav,
  PekuloNavRail,
  PekuloTopTabToggle,
  PekuloUserDot,
  type PekuloNavKey,
  type PekuloTopTab,
  useToast,
} from "@pekulo/ui";
import styles from "./bento.module.css";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export interface CapShellProps {
  email: string | null;
  children: ReactNode;
}

export function CapShell({ email, children }: CapShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDashboardRoot = pathname === "/dashboard";
  const activeTab: PekuloTopTab = searchParams.get("tab") === "patrimoine" ? "patrimoine" : "cap";
  const navActiveKey: PekuloNavKey = pathname.startsWith("/dashboard/portefeuille")
    ? "portfolio"
    : pathname.startsWith("/dashboard/parametres")
      ? "settings"
      : pathname.startsWith("/dashboard/immobilier")
        ? "realestate"
        : pathname.startsWith("/dashboard/transactions")
          ? "transactions"
          : "cap";
  // Off-root screens replace the Cap/Patrimoine tabs with a page-title h1
  // (ux-preview L144-146). Mirrors the SCREEN_TITLE map; covers every nav
  // key the cap-shell can route to.
  const screenTitle: string | null = isDashboardRoot
    ? null
    : navActiveKey === "portfolio"
      ? "Portefeuille"
      : navActiveKey === "settings"
        ? "Paramètres"
        : navActiveKey === "realestate"
          ? "Immobilier"
          : navActiveKey === "transactions"
            ? "Transactions"
            : null;
  // Contextual mobile add button label per active screen. The primitive
  // is a pure styled FAB (`$lg: display:none` keeps it mobile-only); the
  // shell owns the gating so the global "Nouvelle transaction" shortcut
  // also surfaces on cap (diverges intentionally from ux-preview L284-300
  // which only includes transactions / portfolio / realestate). Settings
  // has no primary write action, so it's excluded.
  const CONTEXTUAL_LABEL: Partial<Record<PekuloNavKey, string>> = {
    cap: "Nouvelle transaction",
    portfolio: "Nouvelle ligne",
    transactions: "Nouvelle transaction",
    realestate: "Nouveau bien",
  };
  const contextualAddLabel = CONTEXTUAL_LABEL[navActiveKey];
  const toast = useToast();
  const today = dateFmt.format(new Date());
  const initial = (email ?? "?").charAt(0).toUpperCase();

  const handleNav = (key: PekuloNavKey) => {
    if (key === "cap") {
      router.push("/dashboard");
      return;
    }
    if (key === "settings") {
      router.push("/dashboard/parametres");
      return;
    }
    if (key === "portfolio") {
      router.push("/dashboard/portefeuille");
      return;
    }
    if (key === "realestate") {
      router.push("/dashboard/immobilier");
      return;
    }
    if (key === "transactions") {
      router.push("/dashboard/transactions");
      return;
    }
    toast.info("Bientôt", "Mensuel arrive plus tard.");
  };

  const handleNewTx = () => {
    toast.info("Bientôt", "Saisie de transaction arrive avec la story 5-x.");
  };

  return (
    <div className={styles.shell}>
      <PekuloNavRail activeKey={navActiveKey} onSelect={handleNav} />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.dateLabel} translate="no">
            {today}
          </p>
          {isDashboardRoot && (
            <PekuloTopTabToggle
              topTab={activeTab}
              onChange={(t) =>
                router.push(t === "patrimoine" ? "/dashboard?tab=patrimoine" : "/dashboard")
              }
            />
          )}
          {screenTitle && <h1 className={styles.screenTitle}>{screenTitle}</h1>}
        </div>
        <div className={styles.headerRight}>
          {contextualAddLabel && (
            <PekuloContextualAddButton label={contextualAddLabel} onPress={handleNewTx} />
          )}
          <button
            type="button"
            className={styles.newTxPill}
            onClick={handleNewTx}
            aria-label="Nouvelle transaction"
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden={true} />
            Nouvelle transaction
          </button>
          <PekuloUserDot initial={initial} onPress={() => router.push("/dashboard/parametres")} />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <PekuloMobileBottomNav activeKey={navActiveKey} onSelect={handleNav} />
    </div>
  );
}
