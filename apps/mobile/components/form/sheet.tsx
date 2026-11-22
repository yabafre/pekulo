// apps/mobile/components/form/sheet.tsx
// Shared scaffold for the native iOS form sheets (`app/sheets/*`): the native
// header carries Annuler (left) and the primary action (right, bold), the body
// is the standard keyboard-aware `ScreenShell`, and `useMutationRunner`
// centralises success toasts, dismissal and error routing (sign-in prompt in
// preview mode, inline message for validation, toast otherwise).

import { pekuloColors, useThemeSetting, useToast } from "@pekulo/ui";
import { useRouter } from "expo-router";
import Stack from "expo-router/stack";
import { useRef, useState, type ReactNode } from "react";

import { handleMutationError } from "../../lib/actions";
import { useI18n } from "../../lib/i18n";
import { ScreenShell } from "../screen-shell";
import { FormError } from "./fields";

/**
 * Runs a mutation with consistent feedback. `dismiss` closes the sheet on
 * success; the returned `error` is the inline validation message, if any.
 */
export function useMutationRunner({ dismiss = false }: { dismiss?: boolean } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // `pending` state lags a render behind: two taps dispatched before the
  // re-render would both pass it and post a duplicate. The ref closes that.
  const inFlight = useRef(false);

  async function run(action: () => Promise<unknown>, successTitle?: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      await action();
      if (successTitle) toast.success(successTitle);
      if (dismiss && router.canGoBack()) router.back();
      return true;
    } catch (caught) {
      setError(
        handleMutationError(caught, {
          goToLogin: () => {
            if (dismiss && router.canGoBack()) router.back();
            router.push("/login");
          },
          toastDanger: (title, message) => toast.danger(title, message),
        }),
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { run, error, setError, pending };
}

export function SheetScaffold({
  title,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  error,
  children,
}: {
  title: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const primary = primaryLabel ?? t("common.actions.save");
  const dismissLabel = onPrimary ? t("common.actions.cancel") : t("common.actions.close");
  const { resolvedTheme } = useThemeSetting();
  // TR-strict chrome: the primary action uses the Pekulo ink, not system blue.
  const ink = (resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark).text
    .primary;
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={dismissLabel}
          onPress={() => {
            if (router.canGoBack()) router.back();
          }}
        >
          {dismissLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {onPrimary ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            variant="done"
            tintColor={ink}
            accessibilityLabel={primary}
            disabled={primaryDisabled}
            onPress={onPrimary}
          >
            {primary}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <ScreenShell>
        {children}
        <FormError message={error} />
      </ScreenShell>
    </>
  );
}
