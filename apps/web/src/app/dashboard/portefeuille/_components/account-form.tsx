"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useActionMutation } from "@zapaction/query";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl, FieldError, FieldLabel, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppForm } from "@/hooks/form-hook";
import { deleteAccount, saveAccount } from "@/lib/actions/portfolio";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CURRENCIES,
  accountSchema,
} from "@/lib/schemas/portfolio";
import { portfolioKeys, portfolioTags } from "@/lib/zapaction/keys";
import type { Account, AccountType, Currency } from "@/lib/types";

export function AccountForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Account | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? <Body editing={editing} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ editing, onDone }: { editing: Account | null; onDone: () => void }) {
  const queryClient = useQueryClient();

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.accounts() });
    await queryClient.refetchQueries({ queryKey: portfolioKeys.accounts() });
    onDone();
  };

  const saveMutation = useActionMutation(saveAccount, {
    invalidateWithTags: [portfolioTags.accounts()],
    onSuccess: handleSuccess,
  });
  const deleteMutation = useActionMutation(deleteAccount, {
    invalidateWithTags: [portfolioTags.accounts(), portfolioTags.holdings()],
    onSuccess: handleSuccess,
  });

  type FormValues = {
    id: string | undefined;
    label: string;
    type: AccountType;
    currency: Currency;
    cashBalance: number;
    notes: string;
  };

  const initial: FormValues = editing
    ? {
        id: editing.id,
        label: editing.label,
        type: editing.type,
        currency: editing.currency,
        cashBalance: editing.cashBalance,
        notes: editing.notes ?? "",
      }
    : {
        id: undefined,
        label: "",
        type: "livret",
        currency: "EUR",
        cashBalance: 0,
        notes: "",
      };

  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const payload = accountSchema.parse({
        ...value,
        notes: value.notes && value.notes.length > 0 ? value.notes : null,
      });
      await saveMutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  return (
    <form.AppForm>
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
        <DialogDescription>
          Comptes cash (Livret A / AV) ou enveloppes titres (PEA / CTO).
        </DialogDescription>
      </DialogHeader>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="grid grid-cols-2 gap-4"
      >
        <form.AppField name="label">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-2">
              <FieldLabel>Libellé</FieldLabel>
              <FieldControl>
                <Input
                  type="text"
                  placeholder="Ex. PEA Boursorama"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="type">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as AccountType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="currency">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Devise</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as Currency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="cashBalance">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-2">
              <FieldLabel>Solde cash</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="1"
                  value={field.state.value ?? 0}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    field.handleChange(Number.isNaN(v) ? 0 : v);
                  }}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="notes">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-2">
              <FieldLabel>Notes (optionnel)</FieldLabel>
              <FieldControl>
                <Input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <DialogFooter className="col-span-2">
          {editing ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: editing.id })}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Suppression…
                </>
              ) : (
                "Supprimer"
              )}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => {
              const pending = saveMutation.isPending || isSubmitting;
              return (
                <Button type="submit" disabled={!canSubmit || pending}>
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              );
            }}
          </form.Subscribe>
        </DialogFooter>
      </Form>

      {(saveMutation.isError || deleteMutation.isError) && (
        <p className="text-xs text-destructive">
          Erreur :{" "}
          {(saveMutation.error as Error)?.message ?? (deleteMutation.error as Error)?.message}
        </p>
      )}
    </form.AppForm>
  );
}
