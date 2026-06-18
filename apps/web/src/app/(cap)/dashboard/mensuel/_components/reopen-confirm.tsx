"use client";

// 5-5 reopen confirm (AC-3). Portal + Overlay restored (first pass shipped
// inline render — caught by Alex's visual review). The confirm body explains
// the consequence: row flips back to derived, edits resume. Reopen is NOT
// destructive (reversible) — Confirm button stays primary, not danger.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PekuloButton, PekuloDialog, PekuloDialogCloseX as DialogCloseX } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import { useReopenMonthly } from "../_hooks/use-reopen-monthly";

const MONTH_LABELS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

interface ReopenConfirmProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  year: number;
  monthNum: number;
  onSuccess?: () => void;
}

export function ReopenConfirm({
  open,
  onOpenChange,
  year,
  monthNum,
  onSuccess,
}: ReopenConfirmProps) {
  const t = useTranslations();
  const monthName = MONTH_LABELS_FR[monthNum - 1] ?? "";
  const { mutate, isPending } = useReopenMonthly();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvelopeError(null);
    mutate(
      { year, monthNum },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            onSuccess?.();
          } else {
            setEnvelopeError(result.message);
          }
        },
      },
    );
  }

  return (
    <PekuloDialog open={open} onOpenChange={onOpenChange}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <DialogCloseX />
          <View flexDirection="column" gap="$2">
            <PekuloDialog.Title>
              {t("mensuel.reopen.title", { month: monthName, year })}
            </PekuloDialog.Title>
            <PekuloDialog.Description>{t("mensuel.reopen.description")}</PekuloDialog.Description>
          </View>
          <form onSubmit={handleConfirm} aria-label={t("mensuel.reopen.formAria")}>
            <View flexDirection="column" gap="$3" marginTop="$2">
              {envelopeError !== null && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {envelopeError}
                </Text>
              )}
              <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$2">
                <PekuloButton
                  variant="ghost"
                  onPress={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  {t("common.cancel")}
                </PekuloButton>
                <PekuloButton type="submit" disabled={isPending}>
                  {isPending ? t("mensuel.reopen.submitting") : t("mensuel.reopen.submit")}
                </PekuloButton>
              </View>
            </View>
          </form>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
