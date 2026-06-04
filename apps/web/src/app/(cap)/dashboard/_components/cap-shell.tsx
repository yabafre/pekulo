"use client";

// apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx
//
// Client wrapper that holds the Cap-view chrome (sidebar nav + topbar)
// + the global "Nouvelle transaction" dialog around the bento page content.
// Mirrors ux-preview App.tsx:114-203 verbatim.
//
// The create-transaction dialog lives at this layer because the top-bar
// pill + the mobile FAB are the canonical add entrypoint per ux-preview
// (no inline "+" pill on the page itself). Lifting the dialog state here
// avoids cross-component coordination via search params / Zustand for
// a one-boolean handshake.
//
// Responsive switch is shared between `bento.module.css`
// (`@media (min-width: 1024px)`) and the DS components:
// `PekuloNavRail` hides via `$max-lg = { display: "none" }` (i.e. < 1024)
// and `PekuloMobileBottomNav` hides via `$lg = { display: "none" }` (≥
// 1024). All three pivot at 1024 px = Tamagui v5 `lg`, so the rail / bottom-
// nav / shell-padding flip atomically. (Pre-2026-05-17 the rail used
// `$max-md` claiming Tamagui `md = 1020`; see lesson 2026-05-17 "Tamagui
// v5 media keys" — the real `md` is 768 and the right cutover is 1024.)

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PekuloContextualAddButton,
  PekuloDialog,
  PekuloMobileBottomNav,
  PekuloNavRail,
  PekuloTopTabToggle,
  PekuloUserDot,
  type PekuloNavKey,
  type PekuloTopTab,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { TransactionCreateForm } from "../transactions/_components/transaction-create-form";
import { DashboardEditProvider, useDashboardEdit } from "./dashboard-edit-context";
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

// "Personnaliser" / "Terminé" toggle. A child of DashboardEditProvider so it
// consumes the same editing flag CapView's widget grid reads (the shell itself
// renders the provider, so it can't consume it directly).
function DashboardEditToggle() {
  const { editing, setEditing } = useDashboardEdit();
  return (
    <View
      render="button"
      onPress={() => setEditing((v) => !v)}
      cursor="pointer"
      backgroundColor="transparent"
      borderWidth={0}
      paddingHorizontal="$3"
      aria-label={editing ? "Terminer la personnalisation" : "Personnaliser le tableau de bord"}
    >
      <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
        {editing ? "Terminé" : "Personnaliser"}
      </Text>
    </View>
  );
}

export function CapShell({ email, children }: CapShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [newTxOpen, setNewTxOpen] = useState(false);
  // The "Personnaliser" toggle's visibility depends on the active tab, which is
  // resolved from useSearchParams — empty during the server prerender, real on
  // the client. Gating it behind a post-mount flag keeps the SSR and first
  // client render identical (no hydration mismatch); the toggle fades in after.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
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
          : pathname.startsWith("/dashboard/mensuel")
            ? "monthly"
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
            : navActiveKey === "monthly"
              ? "Mensuel"
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
    if (key === "monthly") {
      router.push("/dashboard/mensuel");
      return;
    }
  };

  const handleNewTx = () => {
    setNewTxOpen(true);
  };

  return (
    <DashboardEditProvider>
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
            {mounted && isDashboardRoot && activeTab === "cap" && <DashboardEditToggle />}
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

        <PekuloDialog open={newTxOpen} onOpenChange={setNewTxOpen}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Nouvelle transaction</PekuloDialog.Title>
                <PekuloDialog.Description>
                  Renseigne le compte, la date, le libellé et le montant.
                </PekuloDialog.Description>
              </View>
              <TransactionCreateForm onSuccess={() => setNewTxOpen(false)} />
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                  alignItems="center"
                >
                  <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                    Annuler
                  </Text>
                </View>
              </PekuloDialog.Close>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      </div>
    </DashboardEditProvider>
  );
}
