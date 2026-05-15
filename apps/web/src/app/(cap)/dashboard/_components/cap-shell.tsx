"use client";

// apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx
//
// Client wrapper that holds the Cap-view chrome (sidebar nav + topbar)
// around the bento page content. Mirrors ux-preview App.tsx:114-203
// verbatim. The responsive switch lives in `bento.module.css` behind a
// single `@media (min-width: 1024px)` rule because Tamagui's media keys
// (md=1020, lg=1280) are NOT aligned with Tailwind's `lg: 1024` and would
// otherwise create a 256 px window where the sidebar overlaps content.
//
// `PekuloNavRail` hides itself below Pekulo Tamagui `md` (= 1020 px) via
// `$max-md`. That's a 4 px gap vs ux-preview's `lg: 1024` switch — visually
// imperceptible, and avoids forking the DS component for this story.

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PekuloNavRail, type PekuloNavKey, useToast } from "@pekulo/ui";
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
  const toast = useToast();
  const today = dateFmt.format(new Date());
  const initial = (email ?? "?").charAt(0).toUpperCase();

  const handleNav = (key: PekuloNavKey) => {
    if (key === "cap") return;
    if (key === "settings") {
      router.push("/dashboard/parametres");
      return;
    }
    const label =
      key === "transactions"
        ? "Transactions"
        : key === "monthly"
          ? "Mensuel"
          : key === "portfolio"
            ? "Portefeuille"
            : "Immobilier";
    toast.info("Bientôt", `${label} arrive plus tard.`);
  };

  const handleNewTx = () => {
    toast.info("Bientôt", "Saisie de transaction arrive avec la story 5-x.");
  };

  return (
    <div className={styles.shell}>
      <PekuloNavRail activeKey="cap" onSelect={handleNav} />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.dateLabel} translate="no">
            {today}
          </p>
          <button
            type="button"
            className={`${styles.topTab} ${styles.topTabActive}`}
            aria-pressed={true}
            aria-current="page"
          >
            Cap
          </button>
          <button
            type="button"
            className={`${styles.topTab} ${styles.topTabInactive}`}
            aria-pressed={false}
            onClick={() => toast.info("Bientôt", "La vue Patrimoine arrive plus tard.")}
          >
            Patrimoine
          </button>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.newTxPill}
            onClick={handleNewTx}
            aria-label="Nouvelle transaction"
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden={true} />
            Nouvelle transaction
          </button>
          <Link
            href="/dashboard/parametres"
            className={styles.userDot}
            aria-label={email ?? "Compte"}
          >
            {initial}
          </Link>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
