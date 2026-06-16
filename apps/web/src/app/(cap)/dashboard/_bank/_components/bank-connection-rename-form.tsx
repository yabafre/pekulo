"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloField,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import type { BankConnection } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useRenameBankConnection } from "../_hooks/use-rename-bank-connection";

const MAX_DISPLAY_NAME = 60;

export interface BankConnectionRenameFormProps {
  connection: BankConnection;
  onSuccess?: () => void;
}

export function BankConnectionRenameForm({ connection, onSuccess }: BankConnectionRenameFormProps) {
  const t = useTranslations("bank");
  const { mutate, isPending, error } = useRenameBankConnection();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { displayName: connection.displayName ?? "" },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.displayName.trim();
        if (trimmed.length === 0) return t("renameForm.nameRequired");
        if (trimmed.length > MAX_DISPLAY_NAME)
          return t("renameForm.maxLength", { max: MAX_DISPLAY_NAME });
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.displayName.trim();
      if (trimmed === (connection.displayName ?? "")) {
        onSuccess?.();
        return;
      }
      setEnvelopeError(null);
      mutate(
        { connectionId: connection.id, displayName: trimmed },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(t("renameForm.notFound"));
              return;
            }
            onSuccess?.();
          },
        },
      );
    },
  });

  useEffect(() => {
    form.reset({ displayName: connection.displayName ?? "" });
    setEnvelopeError(null);
  }, [connection.id, connection.displayName, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label={t("renameForm.ariaLabel")}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="displayName">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="bank-rename-name">
                  {t("renameForm.displayNameLabel")}
                </PekuloFieldLabel>
                <PekuloInput
                  id="bank-rename-name"
                  type="text"
                  maxLength={MAX_DISPLAY_NAME}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
            }
          </form.Subscribe>
          {envelopeError && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{envelopeError}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          {error && !envelopeError && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{error.message}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel={t("renameForm.saving")}>
            {t("renameForm.save")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
