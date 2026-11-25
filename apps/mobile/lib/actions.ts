// apps/mobile/lib/actions.ts
// Native interaction helpers: row action sheets (`ActionSheetIOS` on iOS, the
// Pekulo DS `ActionSheetHost` on Android — story 10-6 AC-3, because Android
// `Alert` dialogs cap at three buttons), destructive confirmations, and the
// single place that turns a mutation error into the right feedback — sign-in
// prompt in preview mode, inline message for validation, toast for anything else.

import { ActionSheetIOS, Alert, Platform } from "react-native";

import { openActionSheet } from "./action-sheet-host";
import { FormValidationError } from "./forms";
import { hapticWarning } from "./haptics";
import { tNow, type MessageKey } from "./i18n";
import { PreviewModeError } from "./hooks/use-mobile-mutations";
import { orpcErrorCode } from "./orpc/errors";

export interface RowAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export function showActions(title: string, actions: RowAction[], message?: string) {
  if (Platform.OS === "ios") {
    const labels = [...actions.map((a) => a.label), tNow("common.actions.cancel")];
    const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: destructive,
      },
      (index) => {
        actions[index]?.onPress();
      },
    );
    return;
  }

  openActionSheet({ title, message, actions });
}

export function confirmDestructive({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  hapticWarning();
  Alert.alert(title, message, [
    { text: tNow("common.actions.cancel"), style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** Contract error code → localised [title, message] (see `@pekulo/contracts`). */
const CONTRACT_ERROR_COPY: Record<string, readonly [MessageKey, MessageKey]> = {
  FORBIDDEN: ["common.errors.forbiddenTitle", "common.errors.forbiddenMessage"],
  RATE_LIMITED: ["common.errors.rateLimitedTitle", "common.errors.rateLimitedMessage"],
  BANK_PROVIDER_UNAVAILABLE: [
    "common.errors.bankUnavailableTitle",
    "common.errors.bankUnavailableMessage",
  ],
  MONTHLY_OUT_OF_WINDOW: [
    "common.errors.monthlyOutOfWindowTitle",
    "common.errors.monthlyOutOfWindowMessage",
  ],
  MONTHLY_SIGNED_OFF: [
    "common.errors.monthlySignedOffTitle",
    "common.errors.monthlySignedOffMessage",
  ],
  ACCOUNT_PARTIALLY_ERASED: [
    "common.errors.partialErasureTitle",
    "common.errors.partialErasureMessage",
  ],
  ACCOUNT_REFERENCED_FK: ["common.errors.accountInUseTitle", "common.errors.accountInUseMessage"],
  HOLDING_CLOSED: ["common.errors.holdingClosedTitle", "common.errors.holdingClosedMessage"],
  MORTGAGE_ALREADY_ATTACHED: [
    "common.errors.alreadyAttachedTitle",
    "common.errors.alreadyAttachedMessage",
  ],
  RENTAL_ALREADY_ATTACHED: [
    "common.errors.alreadyAttachedTitle",
    "common.errors.alreadyAttachedMessage",
  ],
};

const NOT_FOUND_COPY = ["common.errors.notFoundTitle", "common.errors.notFoundMessage"] as const;

/** Localised copy for a typed contract failure, or `null` for anything else. */
export function contractErrorCopy(error: unknown): { title: string; message: string } | null {
  const code = orpcErrorCode(error);
  if (!code) return null;
  const keys = CONTRACT_ERROR_COPY[code] ?? (code.endsWith("_NOT_FOUND") ? NOT_FOUND_COPY : null);
  return keys ? { title: tNow(keys[0]), message: tNow(keys[1]) } : null;
}

/**
 * Route a failed mutation to the right feedback. Returns the message to show
 * inline under the form for validation errors, `null` when already handled.
 */
export function handleMutationError(
  error: unknown,
  {
    goToLogin,
    toastDanger,
  }: { goToLogin: () => void; toastDanger: (title: string, message?: string) => void },
): string | null {
  if (error instanceof PreviewModeError) {
    Alert.alert(tNow("common.errors.previewTitle"), tNow("common.errors.previewMessage"), [
      { text: tNow("common.actions.later"), style: "cancel" },
      { text: tNow("common.actions.signIn"), onPress: goToLogin },
    ]);
    return null;
  }
  if (error instanceof FormValidationError) {
    return error.message;
  }
  const typed = contractErrorCopy(error);
  if (typed) {
    toastDanger(typed.title, typed.message);
    return null;
  }
  toastDanger(tNow("common.errors.saveFailedTitle"), tNow("common.errors.saveFailedMessage"));
  return null;
}
