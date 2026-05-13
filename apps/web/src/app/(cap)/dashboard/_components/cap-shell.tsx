"use client";

// apps/web/src/app/(cap)/dashboard/_components/cap-shell.tsx
//
// Client wrapper that holds the Cap-view chrome (sidebar nav + topbar)
// around the bento page content. Mirrors ux-preview App.tsx:122-178 +
// the `<NavRail>` at 218-263. Story 1-4 owns the chrome shell for the
// Cap surface because story 1-4 is the first story to ship a real
// `(cap)/*` route; the sibling routes (`/dashboard/transactions`,
// `/dashboard/mensuel`, `/dashboard/portefeuille`, `/dashboard/immobilier`)
// land in their own stories — the shell's NavRail surfaces them as future
// destinations with a toast "Bientôt".

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { PekuloNavRail, type PekuloNavKey, useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

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
    if (key === "cap") return; // already here
    if (key === "settings") {
      router.push("/dashboard/parametres");
      return;
    }
    // The other NavRail destinations (transactions / mensuel / portefeuille
    // / immobilier) ship with their own stories. Surface a toast so the
    // user understands why the click was a no-op rather than a silent
    // failure.
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
    <View flex={1} minHeight="100vh" backgroundColor="$background">
      <PekuloNavRail activeKey="cap" onSelect={handleNav} />
      <View flex={1} $lg={{ paddingLeft: 80 }}>
        <View
          render="header"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$5"
          paddingTop="$6"
          paddingBottom="$2"
          gap="$3"
          $lg={{ paddingHorizontal: "$2", paddingTop: "$6" }}
        >
          <View flexDirection="row" alignItems="baseline" gap="$3" flexWrap="wrap">
            <Text color="$colorTertiary" fontSize="$caption">
              {today}
            </Text>
            <Text color="$color" fontSize="$h2" fontWeight="600">
              Cap
            </Text>
            <Text color="$colorTertiary" fontSize="$h2" fontWeight="600">
              Patrimoine
            </Text>
          </View>
          <View flexDirection="row" alignItems="center" gap="$3">
            <View
              render="button"
              flexDirection="row"
              alignItems="center"
              gap="$2"
              height={40}
              paddingHorizontal="$4"
              borderRadius="$full"
              backgroundColor="$color"
              cursor="pointer"
              hoverStyle={{ opacity: 0.9 }}
              focusVisibleStyle={{
                outlineColor: "$borderFocus",
                outlineStyle: "solid",
                outlineWidth: 2,
              }}
              onPress={handleNewTx}
              aria-label="Nouvelle transaction"
            >
              <Plus size={14} color="var(--colorOnAccent)" aria-hidden={true} />
              <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="500">
                Nouvelle transaction
              </Text>
            </View>
            <View
              width={36}
              height={36}
              borderRadius="$full"
              backgroundColor="$backgroundMuted"
              alignItems="center"
              justifyContent="center"
              aria-label={email ?? "Compte"}
            >
              <Text color="$color" fontSize="$bodySm" fontWeight="600">
                {initial}
              </Text>
            </View>
          </View>
        </View>
        <View render="main" flex={1}>
          {children}
        </View>
      </View>
    </View>
  );
}
