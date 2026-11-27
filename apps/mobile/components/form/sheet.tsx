// apps/mobile/components/form/sheet.tsx
// Shared scaffold for the form sheets (`app/sheets/*`).
//   - iOS: the native header carries Annuler (left) and the primary action
//     (right, bold) through `Stack.Toolbar`.
//   - Android (story 10-6 AC-2): `Stack.Toolbar` throws without `@expo/ui` and
//     the sheets are presented headerless (app/_layout.tsx), so the same three
//     controls render as an in-content header row.
// The body is the standard keyboard-aware `ScreenShell`, and `useMutationRunner`
// centralises success toasts, dismissal and error routing (sign-in prompt in
// preview mode, inline message for validation, toast otherwise).

import { pekuloColors, useThemeSetting, useToast } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import Stack from "expo-router/stack";
import { useRef, useState, type ReactNode } from "react";
import { Platform, Pressable } from "react-native";

import { handleMutationError } from "../../lib/actions";
import { hapticError, hapticSuccess } from "../../lib/haptics";
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
      hapticSuccess();
      if (successTitle) toast.success(successTitle);
      if (dismiss && router.canGoBack()) router.back();
      return true;
    } catch (caught) {
      hapticError();
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

/** Android in-content header button: 48dp touch target, Pekulo ink, no system tint. */
function SheetHeaderButton({
  label,
  onPress,
  disabled = false,
  emphasized = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  emphasized?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text color="$color" fontSize="$body" fontWeight={emphasized ? "600" : "400"}>
        {label}
      </Text>
    </Pressable>
  );
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
  const dismiss = () => {
    if (router.canGoBack()) router.back();
  };

  if (Platform.OS === "android") {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ScreenShell>
          <View flexDirection="row" alignItems="center" justifyContent="space-between" gap="$3">
            <SheetHeaderButton label={dismissLabel} onPress={dismiss} testID="sheet-dismiss-btn" />
            <Text
              flex={1}
              textAlign="center"
              color="$color"
              fontSize="$body"
              fontWeight="600"
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {onPrimary ? (
              <SheetHeaderButton
                label={primary}
                onPress={onPrimary}
                disabled={primaryDisabled}
                emphasized
                testID="sheet-primary-btn"
              />
            ) : (
              <View width={48} />
            )}
          </View>
          {children}
          <FormError message={error} />
        </ScreenShell>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button accessibilityLabel={dismissLabel} onPress={dismiss}>
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
