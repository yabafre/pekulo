// apps/mobile/lib/actions.ts
// Native iOS interaction helpers: row action sheets (`ActionSheetIOS`, with an
// `Alert` fallback on Android), destructive confirmations, and the single place
// that turns a mutation error into the right feedback — sign-in prompt in
// preview mode, inline message for validation, toast for anything else.

import { ActionSheetIOS, Alert, Platform } from "react-native";

import { FormValidationError } from "./forms";
import { tNow } from "./i18n";
import { PreviewModeError } from "./hooks/use-mobile-mutations";

export interface RowAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export function showActions(title: string, actions: RowAction[], message?: string) {
  const labels = [...actions.map((a) => a.label), tNow("common.actions.cancel")];
  const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));

  if (Platform.OS === "ios") {
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

  Alert.alert(title, message, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ("destructive" as const) : ("default" as const),
      onPress: a.onPress,
    })),
    { text: tNow("common.actions.cancel"), style: "cancel" as const },
  ]);
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
  Alert.alert(title, message, [
    { text: tNow("common.actions.cancel"), style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
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
  toastDanger(tNow("common.errors.saveFailedTitle"), tNow("common.errors.saveFailedMessage"));
  return null;
}
