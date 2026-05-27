"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  PekuloDialog,
  PekuloPopover,
  PekuloSkeleton,
  pekuloFontSizes,
  pekuloRadius,
} from "@pekulo/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import type { Account, AccountCurrency } from "@pekulo/validators";
import type { AccountType } from "@pekulo/types";
import { useAccounts } from "../_hooks/use-accounts";
import { AccountCreateForm } from "./account-create-form";
import { AccountEditForm } from "./account-edit-form";
import { AccountBalanceForm } from "./account-balance-form";
import { AccountDeleteConfirm } from "./account-delete-confirm";

// Flat layout — mirrors ux-preview AccountsSection (App.tsx:558-581). No
// card wrapper; the parent Patrimoine view supplies the page-level gap-10
// rhythm. Per-row trailing actions open dialogs (Solde · Modifier ·
// Supprimer). The header "+ Ajouter" button opens the create dialog.

const TYPE_LABEL: Record<AccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
  banque: "Compte courant",
};

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatBalance(amount: number, currency: AccountCurrency): string {
  if (currency === "EUR") return eur0.format(amount);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const addPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  border: "none",
  cursor: "pointer",
  fontSize: pekuloFontSizes.caption,
  fontWeight: 500,
};

const rowActionBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  fontSize: pekuloFontSizes.xs,
  padding: "4px 8px",
};

const dangerRowActionBtn: CSSProperties = { ...rowActionBtn, color: "var(--danger)" };

const kebabBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: pekuloRadius.full,
};

// Module-scoped constants — avoid re-allocating per row render (the
// `accounts-section.tsx` map iterates 2-3 popover buttons per account).
// Story 2-3 review LOW #13.
const popoverActionBtnBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "8px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
  borderRadius: pekuloRadius.md,
  textAlign: "left",
};
const popoverActionBtnNeutral: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--color)",
};
const popoverActionBtnDanger: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--danger)",
};

type DialogKind = "create" | "edit" | "balance" | "delete" | null;

export function AccountsSection() {
  const { data, isLoading, error } = useAccounts();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  // Hydration guard — TanStack cache may pre-populate the client between
  // navigations, causing SSR (role="status" loading) ↔ first paint
  // (role="list" data) hydration mismatch. See lessons.md 2026-05-24.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;

  const closeAll = () => {
    setOpenDialog(null);
    setActiveAccount(null);
  };

  const openFor = (kind: Exclude<DialogKind, null | "create">, account: Account) => {
    setActiveAccount(account);
    setOpenDialog(kind);
  };

  const accounts = data ?? [];
  const totalLiquide = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);

  return (
    <View render="section" aria-labelledby="acc-h" flexDirection="column">
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        marginBottom="$3"
      >
        <Text
          id="acc-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          $lg={{ fontSize: "$h2" }}
        >
          Comptes
        </Text>
        <button
          type="button"
          onClick={() => setOpenDialog("create")}
          style={addPill}
          aria-label="Ajouter un compte"
        >
          <Plus size={12} strokeWidth={2.25} aria-hidden />
          Ajouter
        </button>
      </View>

      {showLoading && (
        <View role="status" aria-live="polite">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement…
          </Text>
          <PekuloSkeleton lines={3} height={48} />
        </View>
      )}
      {error && !showLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && accounts.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucun compte. Ajoute ton premier compte pour démarrer.
        </Text>
      )}

      {!showLoading && accounts.length > 0 && (
        <View flexDirection="column" role="list" aria-label="Liste des comptes">
          {accounts.map((acc) => (
            <View
              key={acc.id}
              role="listitem"
              flexDirection="row"
              alignItems="center"
              gap="$3"
              paddingVertical="$3"
            >
              <View flex={1} minWidth={0}>
                <Text color="$color" fontSize="$bodySm" fontWeight="500">
                  {acc.label}
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  {TYPE_LABEL[acc.type]} · {acc.currency}
                </Text>
              </View>
              <Text color="$color" fontSize="$bodySm" fontWeight="500">
                {formatBalance(acc.cashBalance, acc.currency)}
              </Text>
              <View
                flexDirection="row"
                gap="$2"
                marginLeft="$2"
                display="none"
                $lg={{ display: "flex" }}
              >
                <button
                  type="button"
                  onClick={() => openFor("balance", acc)}
                  style={rowActionBtn}
                  aria-label={`Modifier le solde de ${acc.label}`}
                >
                  Solde
                </button>
                <button
                  type="button"
                  onClick={() => openFor("edit", acc)}
                  style={rowActionBtn}
                  aria-label={`Modifier ${acc.label}`}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => openFor("delete", acc)}
                  style={dangerRowActionBtn}
                  aria-label={`Supprimer ${acc.label}`}
                >
                  Supprimer
                </button>
              </View>

              <View marginLeft="$2" $lg={{ display: "none" }}>
                <PekuloPopover>
                  <PekuloPopover.Trigger style={kebabBtn} aria-label={`Actions ${acc.label}`}>
                    <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                  </PekuloPopover.Trigger>
                  <PekuloPopover.Content minWidth={180}>
                    <button
                      type="button"
                      onClick={() => openFor("balance", acc)}
                      style={popoverActionBtnNeutral}
                    >
                      Modifier le solde
                    </button>
                    <button
                      type="button"
                      onClick={() => openFor("edit", acc)}
                      style={popoverActionBtnNeutral}
                    >
                      Modifier le compte
                    </button>
                    <button
                      type="button"
                      onClick={() => openFor("delete", acc)}
                      style={popoverActionBtnDanger}
                    >
                      Supprimer
                    </button>
                  </PekuloPopover.Content>
                </PekuloPopover>
              </View>
            </View>
          ))}
        </View>
      )}

      {!showLoading && accounts.length > 0 && (
        <View
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingTop="$3"
          marginTop="$2"
          borderTopWidth={1}
          borderColor="$borderDefault"
        >
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            letterSpacing={0.5}
            textTransform="uppercase"
          >
            Total liquide
          </Text>
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {eur0.format(totalLiquide)}
          </Text>
        </View>
      )}

      <PekuloDialog open={openDialog === "create"} onOpenChange={(o) => !o && closeAll()}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <View flexDirection="column" gap="$3">
              <PekuloDialog.Title>Ajouter un compte</PekuloDialog.Title>
              <PekuloDialog.Description>
                Renseigne le libellé, le type et le solde initial.
              </PekuloDialog.Description>
            </View>
            <AccountCreateForm onSuccess={closeAll} />
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

      {activeAccount && (
        <PekuloDialog open={openDialog === "edit"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Modifier « {activeAccount.label} »</PekuloDialog.Title>
              </View>
              <AccountEditForm account={activeAccount} onSuccess={closeAll} />
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
      )}

      {activeAccount && (
        <PekuloDialog open={openDialog === "balance"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Modifier le solde — {activeAccount.label}</PekuloDialog.Title>
                <PekuloDialog.Description>
                  Saisis la date et le nouveau solde — une entrée d'audit sera enregistrée.
                </PekuloDialog.Description>
              </View>
              <AccountBalanceForm account={activeAccount} onSuccess={closeAll} />
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
      )}

      {activeAccount && (
        <AccountDeleteConfirm
          account={activeAccount}
          open={openDialog === "delete"}
          onOpenChange={(o) => !o && closeAll()}
        />
      )}
    </View>
  );
}
