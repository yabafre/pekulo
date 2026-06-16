"use client";

import { useTranslations } from "next-intl";
import {
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSelect,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import {
  ACCOUNT_CURRENCIES,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_ACCOUNT_NOTES_LENGTH,
} from "@pekulo/validators";
import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useCreateAccount } from "../_hooks/use-create-account";
// Devise lives behind the FX work in story 3-3; until that ships, every new
// account is created in EUR. The Patrimoine total sums raw `cashBalance`
// values and formats them as EUR — exposing the multi-currency selector
// would let the user enter a USD balance that then displays under a "€"
// glyph. Lock to EUR for the V1 perso window. (Story 2-3 review HIGH #6.)
const FORCED_CURRENCY: (typeof ACCOUNT_CURRENCIES)[number] = "EUR";
void ACCOUNT_CURRENCIES;

export interface AccountCreateFormProps {
  onSuccess?: () => void;
}

export function AccountCreateForm({ onSuccess }: AccountCreateFormProps) {
  const t = useTranslations("accounts");
  const TYPE_LABEL: Record<AccountType, string> = {
    livret: t("types.livret"),
    pea: t("types.pea"),
    cto: t("types.cto"),
    av: t("types.av"),
    autre: t("types.autre"),
    banque: t("types.banque"),
  };
  const { mutate, isPending, error, isSuccess, reset } = useCreateAccount();

  const form = useAppForm({
    defaultValues: {
      label: "",
      type: "livret" as AccountType,
      cashBalance: "0",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.label.trim();
        if (trimmed.length === 0) {
          return t("labelRequired");
        }
        if (trimmed.length > MAX_ACCOUNT_LABEL_LENGTH) {
          return t("labelTooLong", { max: MAX_ACCOUNT_LABEL_LENGTH });
        }
        const balance = Number(value.cashBalance);
        if (!Number.isFinite(balance) || balance < 0) {
          return t("balanceInvalid");
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_ACCOUNT_NOTES_LENGTH) {
          return t("notesTooLong", { max: MAX_ACCOUNT_NOTES_LENGTH });
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.label.trim();
      const balance = Number(value.cashBalance);
      const trimmedNotes = value.notes.trim();
      mutate(
        {
          label: trimmed,
          type: value.type,
          currency: FORCED_CURRENCY,
          cashBalance: balance,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: () => {
            form.reset();
            reset();
            onSuccess?.();
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label={t("createFormAria")}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-label">{t("fields.label")}</PekuloFieldLabel>
                <PekuloInput
                  id="acc-label"
                  type="text"
                  maxLength={MAX_ACCOUNT_LABEL_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-type">{t("fields.type")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as AccountType)}
                >
                  <PekuloSelect.Trigger id="acc-type">
                    <PekuloSelect.Value placeholder={t("chooseType")} />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {ACCOUNT_TYPES.map((at, i) => (
                        <PekuloSelect.Item key={at} value={at} index={i}>
                          {TYPE_LABEL[at]}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <PekuloField>
            <PekuloFieldLabel htmlFor="acc-currency">{t("fields.currency")}</PekuloFieldLabel>
            <PekuloInput
              id="acc-currency"
              type="text"
              value={FORCED_CURRENCY}
              readOnly
              aria-readonly="true"
              style={{ opacity: 0.6, cursor: "not-allowed" }}
            />
            <PekuloFieldDescription>{t("currencyNote")}</PekuloFieldDescription>
          </PekuloField>
          <form.Field name="cashBalance">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-balance">
                  {t("fields.initialBalance")}
                </PekuloFieldLabel>
                <PekuloInput
                  id="acc-balance"
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-notes">{t("fields.notesOptional")}</PekuloFieldLabel>
                <PekuloInput
                  id="acc-notes"
                  type="text"
                  maxLength={MAX_ACCOUNT_NOTES_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
            }
          </form.Subscribe>
          {error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{error.message}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          {isSuccess && !error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : (
                  <PekuloFieldDescription color="$success">{t("added")}</PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel={t("adding")}>
            {t("addAccount")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
