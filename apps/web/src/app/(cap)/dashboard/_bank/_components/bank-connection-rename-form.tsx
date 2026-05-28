"use client";

import { useEffect, useState } from "react";
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
const NOT_FOUND_MESSAGE = "Connexion introuvable — elle a peut-être été révoquée.";

export interface BankConnectionRenameFormProps {
  connection: BankConnection;
  onSuccess?: () => void;
}

export function BankConnectionRenameForm({ connection, onSuccess }: BankConnectionRenameFormProps) {
  const { mutate, isPending, error } = useRenameBankConnection();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { displayName: connection.displayName ?? "" },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.displayName.trim();
        if (trimmed.length === 0) return "Nom requis";
        if (trimmed.length > MAX_DISPLAY_NAME) return `Maximum ${MAX_DISPLAY_NAME} caractères`;
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
              setEnvelopeError(NOT_FOUND_MESSAGE);
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
      aria-label="Renommer la connexion"
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="displayName">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="bank-rename-name">Nom affiché</PekuloFieldLabel>
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
          <PekuloSubmitButton loading={isPending} loadingLabel="Enregistrement…">
            Enregistrer
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
