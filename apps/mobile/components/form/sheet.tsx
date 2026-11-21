// apps/mobile/components/form/sheet.tsx
// Shared scaffold for the native iOS form sheets (`app/sheets/*`): the native
// header carries Annuler (left) and the primary action (right, bold), the body
// is the standard keyboard-aware `ScreenShell`, and `useMutationRunner`
// centralises success toasts, dismissal and error routing (sign-in prompt in
// preview mode, inline message for validation, toast otherwise).

import { useToast } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import Stack from "expo-router/stack";
import { useState, type ReactNode } from "react";
import { Pressable } from "react-native";

import { handleMutationError } from "../../lib/actions";
import { ScreenShell } from "../screen-shell";
import { FormError } from "./fields";

export function HeaderTextButton({
  label,
  onPress,
  prominent,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  prominent?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text color="$color" fontSize="$body" fontWeight={prominent ? "600" : "400"}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Runs a mutation with consistent feedback. `dismiss` closes the sheet on
 * success; the returned `error` is the inline validation message, if any.
 */
export function useMutationRunner({ dismiss = false }: { dismiss?: boolean } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>, successTitle?: string) {
    if (pending) return false;
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
      setPending(false);
    }
  }

  return { run, error, setError, pending };
}

export function SheetScaffold({
  title,
  primaryLabel = "Enregistrer",
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
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <HeaderTextButton
              label={onPrimary ? "Annuler" : "Fermer"}
              testID="sheet-cancel-btn"
              onPress={() => {
                if (router.canGoBack()) router.back();
              }}
            />
          ),
          headerRight: onPrimary
            ? () => (
                <HeaderTextButton
                  label={primaryLabel}
                  prominent
                  disabled={primaryDisabled}
                  testID="sheet-primary-btn"
                  onPress={onPrimary}
                />
              )
            : undefined,
        }}
      />
      <ScreenShell>
        {children}
        <FormError message={error} />
      </ScreenShell>
    </>
  );
}
