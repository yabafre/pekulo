"use client";

import { type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import { PekuloPopover, pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import { MoreHorizontal } from "lucide-react";
import type { BankConnection } from "@pekulo/validators";
import { BankReconnectButton } from "./bank-reconnect-button";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

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
const popoverActionBtnNeutral: CSSProperties = { ...popoverActionBtnBase, color: "var(--color)" };
const popoverActionBtnDanger: CSSProperties = { ...popoverActionBtnBase, color: "var(--danger)" };

export interface BankConnectionRowProps {
  connection: BankConnection;
  onRename: (connection: BankConnection) => void;
  onRevoke: (connection: BankConnection) => void;
}

export function BankConnectionRow({ connection, onRename, onRevoke }: BankConnectionRowProps) {
  const t = useTranslations("bank");
  const label = connection.displayName ?? connection.providerItemId;
  const isSca = connection.status === "sca_required";
  const lastSynced = connection.lastSyncedAt
    ? t("connectionRow.syncedOn", { date: dateFmt.format(new Date(connection.lastSyncedAt)) })
    : t("connectionRow.neverSynced");

  return (
    <View role="listitem" flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <View flex={1} minWidth={0}>
        <View flexDirection="row" alignItems="center" gap="$2">
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {label}
          </Text>
          {isSca && (
            <View
              backgroundColor="$backgroundMuted"
              borderRadius="$full"
              paddingHorizontal="$2"
              paddingVertical="$1"
            >
              <Text color="$warning" fontSize="$xs" fontWeight="600">
                {t("connectionRow.scaExpired")}
              </Text>
            </View>
          )}
        </View>
        <Text color="$colorTertiary" fontSize="$caption">
          {lastSynced}
        </Text>
      </View>

      {isSca && (
        <View marginRight="$2">
          <BankReconnectButton connectionId={connection.id} />
        </View>
      )}

      <View flexDirection="row" gap="$2" marginLeft="$2" display="none" $lg={{ display: "flex" }}>
        <button
          type="button"
          onClick={() => onRename(connection)}
          style={rowActionBtn}
          aria-label={t("connectionRow.renameAriaLabel", { name: label })}
        >
          {t("connectionRow.rename")}
        </button>
        <button
          type="button"
          onClick={() => onRevoke(connection)}
          style={dangerRowActionBtn}
          aria-label={t("connectionRow.revokeAriaLabel", { name: label })}
        >
          {t("connectionRow.revoke")}
        </button>
      </View>

      <View marginLeft="$2" $lg={{ display: "none" }}>
        <PekuloPopover>
          <PekuloPopover.Trigger
            style={kebabBtn}
            aria-label={t("connectionRow.actionsAriaLabel", { name: label })}
          >
            <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
          </PekuloPopover.Trigger>
          <PekuloPopover.Content minWidth={180}>
            <button
              type="button"
              onClick={() => onRename(connection)}
              style={popoverActionBtnNeutral}
            >
              {t("connectionRow.rename")}
            </button>
            <button
              type="button"
              onClick={() => onRevoke(connection)}
              style={popoverActionBtnDanger}
            >
              {t("connectionRow.revoke")}
            </button>
          </PekuloPopover.Content>
        </PekuloPopover>
      </View>
    </View>
  );
}
