// apps/mobile/app/sheets/delete-account.tsx
// Story 10-6 AC-4 — Android account deletion with typed-email confirmation.
// `Alert.prompt` (the iOS path in app/parametres.tsx) does not exist on Android;
// this sheet runs the same `isDeletionEmailConfirmed` check and the same
// `useDeleteUserAccount` mutation (which signs out), then replaces to /login.
// Presented only from the Android branch of Paramètres.

import { Text } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { DestructiveButton, FormSection, TextField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { isDeletionEmailConfirmed } from "../../lib/account-deletion";
import { useAuth } from "../../lib/auth/auth-context";
import { useDeleteUserAccount } from "../../lib/hooks/use-mobile-mutations";
import { useI18n } from "../../lib/i18n";

export default function DeleteAccountSheet() {
  const router = useRouter();
  const { userEmail } = useAuth();
  const deleteAccount = useDeleteUserAccount();
  const { run, error, pending } = useMutationRunner();
  const { t } = useI18n();
  const [typed, setTyped] = useState("");

  function handleConfirm() {
    if (pending) return;
    if (!isDeletionEmailConfirmed(typed, userEmail)) {
      Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
      return;
    }
    const confirmationEmail = typed.trim();
    void run(async () => {
      await deleteAccount.mutateAsync({ confirmationEmail });
      router.replace("/login");
    }, t("settings.deletion.done"));
  }

  return (
    <SheetScaffold title={t("settings.deletion.title")} error={error}>
      <FormSection>
        <Text color="$colorSecondary" fontSize="$bodySm">
          {t("settings.deletion.message", {
            email: userEmail ?? t("settings.deletion.yourEmail"),
          })}
        </Text>
        <TextField
          label={t("settings.deletion.emailLabel")}
          value={typed}
          onChange={setTyped}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="delete-account-email"
        />
      </FormSection>
      <DestructiveButton
        label={t("settings.deletion.button")}
        onPress={handleConfirm}
        testID="delete-account-confirm-btn"
      />
    </SheetScaffold>
  );
}
