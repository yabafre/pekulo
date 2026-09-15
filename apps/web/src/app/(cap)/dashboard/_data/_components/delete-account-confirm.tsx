"use client";

// apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.tsx
// Story 11-2 (FR-50 / AC-8). Destructive confirmation dialog. Shape follows
// the sibling reference implementation
// immobilier/_components/property-delete-confirm.tsx: PekuloDialog +
// Portal/Overlay/Content, a danger button from inline CSSProperties, a plain
// Close for cancel.
//
// The typed-email gate comes from docs/ux/flows.md § Account deletion ("Type
// the email to confirm"). The client gate is UX: the SERVER performs the same
// comparison against the email on the verified JWT, so a direct RPC call with
// no dialog is refused too (AC-7).
//
// Every label rides a Tamagui <Text>, never bare DOM text: `--f-family` is
// scoped to Tamagui's `font_*` classes, so raw text inside a View renders in
// the browser-default serif (lesson 2026-07-13). Icons live INSIDE their
// <Text> so they inherit colour via currentColor rather than falling back to
// the UA default on a dark card (lesson from story 11-1's review, where an
// uncoloured icon measured ~1.03:1).
import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import {
  PekuloDialog,
  PekuloDialogCloseX as DialogCloseX,
  PekuloInput,
  PekuloLabel,
  pekuloFontSizes,
  pekuloRadius,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { purgeOfflineCache } from "@/lib/offline/cache-db";
import { useDeleteUserAccount } from "../_hooks/use-delete-account";

const dangerBtn = (disabled: boolean): CSSProperties => ({
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "var(--danger)",
  color: "var(--colorOnAccent)",
  height: 40,
  padding: "0 16px",
  borderRadius: pekuloRadius.full,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
});

const CONFIRM_INPUT_ID = "delete-account-confirm-email";

export interface DeleteAccountConfirmProps {
  /** The signed-in account's email — the string the user must retype. */
  email: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function DeleteAccountConfirm({ email, open, onOpenChange }: DeleteAccountConfirmProps) {
  const t = useTranslations("settings.data");
  const tCommon = useTranslations("common");
  const { mutate, isPending, error, reset } = useDeleteUserAccount();
  const [typed, setTyped] = useState("");

  // Same normalisation the server applies, so the button never enables on a
  // value the server will then refuse.
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  const handleClose = (next: boolean) => {
    if (!next) {
      setTyped("");
      reset();
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!matches || isPending) return;
    // AC-8 + ADR-0003: the decrypted-at-rest snapshot must not outlive the
    // account. It is purged BEFORE the call because the server action ends in
    // a redirect (see delete-account-action.ts) and never resolves on this
    // side, so there is no "after". Purging ahead of a deletion that then
    // fails costs nothing: the cache is a read-through copy and refills on
    // the next dashboard load. `onAuthStateChange('SIGNED_OUT')` never fires
    // here (auth runs server-side under httpOnly cookies), which is why this
    // mirrors _account/_components/sign-out-button.tsx. Exception-safe: a
    // storage failure must never block the deletion itself.
    await purgeOfflineCache().catch(() => undefined);
    mutate(
      { confirmationEmail: typed.trim() },
      {
        onSuccess: () => {
          // Belt and braces: the server redirect normally navigates first. If
          // it ever resolves here instead, nothing client-side — the React
          // Query cache included — may outlive the account, so leave with a
          // full document load.
          window.location.assign("/");
        },
      },
    );
  };

  const errorMessage = error
    ? error.message.includes("bank provider unavailable")
      ? t("deleteProviderError")
      : t("deleteGenericError")
    : null;

  return (
    <PekuloDialog open={open} onOpenChange={handleClose}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <DialogCloseX />
          <View flexDirection="column" gap="$3" padding="$4">
            <PekuloDialog.Title>{t("deleteTitle")}</PekuloDialog.Title>
            <PekuloDialog.Description>{t("deleteDescription")}</PekuloDialog.Description>

            <View flexDirection="column" gap="$2">
              <PekuloLabel htmlFor={CONFIRM_INPUT_ID}>{t("deleteConfirmLabel")}</PekuloLabel>
              <Text color="$colorTertiary" fontSize="$caption">
                {t("deleteConfirmPrompt", { email })}
              </Text>
              <PekuloInput
                id={CONFIRM_INPUT_ID}
                type="email"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                disabled={isPending}
              />
            </View>

            {errorMessage && (
              <Text role="alert" color="$danger" fontSize="$caption">
                {errorMessage}
              </Text>
            )}

            <View flexDirection="row" gap="$3" alignItems="center">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!matches || isPending}
                aria-disabled={!matches || isPending}
                aria-busy={isPending}
                style={dangerBtn(!matches || isPending)}
              >
                <Trash2 size={14} strokeWidth={2} color="currentColor" aria-hidden />
                {isPending ? t("deleteLoading") : t("deleteConfirm")}
              </button>
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                >
                  <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                    {tCommon("cancel")}
                  </Text>
                </View>
              </PekuloDialog.Close>
            </View>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
