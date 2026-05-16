"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
import { Plus } from "lucide-react";
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
  fontSize: 13,
  fontWeight: 500,
};

const rowActionBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  fontSize: 12,
  padding: "4px 8px",
};

const dangerRowActionBtn: CSSProperties = { ...rowActionBtn, color: "var(--danger)" };

type DialogKind = "create" | "edit" | "balance" | "delete" | null;

export function AccountsSection() {
  const { data, isLoading, error } = useAccounts();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);

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

      {isLoading && (
        <Text color="$colorTertiary" fontSize="$caption" role="status">
          Chargement…
        </Text>
      )}
      {error && !isLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!isLoading && !error && accounts.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucun compte. Ajoute ton premier compte pour démarrer.
        </Text>
      )}

      {accounts.length > 0 && (
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
              <View flexDirection="row" gap="$2" marginLeft="$2">
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
            </View>
          ))}
        </View>
      )}

      {accounts.length > 0 && (
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
