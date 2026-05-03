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
import { deleteTransaction, saveTransaction } from "@/lib/actions/transactions";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  transactionInputSchema,
} from "@/lib/schemas/transactions";
import { transactionsKeys, transactionsTags } from "@/lib/zapaction/keys";
import type { Transaction } from "@/lib/types";

export function TransactionForm({
  open,
  onOpenChange,
  editing,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Transaction | null;
  defaultDate: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <Body editing={editing} defaultDate={defaultDate} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  editing,
  defaultDate,
  onDone,
}: {
  editing: Transaction | null;
  defaultDate: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: transactionsKeys.list() });
    await queryClient.refetchQueries({ queryKey: transactionsKeys.list() });
    onDone();
  };

  const saveMutation = useActionMutation(saveTransaction, {
    invalidateWithTags: [transactionsTags.list()],
    onSuccess: handleSuccess,
  });
  const deleteMutation = useActionMutation(deleteTransaction, {
    invalidateWithTags: [transactionsTags.list()],
    onSuccess: handleSuccess,
  });

  type FormValues = {
    id: string | undefined;
    occurredOn: string;
    label: string;
    amount: number;
    type: "inflow" | "outflow";
    category: import("@/lib/types").TransactionCategory;
    isImprevu: boolean;
    notes: string;
  };

  const initial: FormValues = editing
    ? {
        id: editing.id,
        occurredOn: editing.occurredOn,
        label: editing.label,
        amount: editing.amount,
        type: editing.type,
        category: editing.category,
        isImprevu: editing.isImprevu,
        notes: editing.notes ?? "",
      }
    : {
        id: undefined,
        occurredOn: defaultDate,
        label: "",
        amount: 0,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: "",
      };

  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const payload = transactionInputSchema.parse({
        ...value,
        notes: value.notes && value.notes.length > 0 ? value.notes : null,
      });
      await saveMutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, defaultDate]);

  return (
    <form.AppForm>
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier la transaction" : "Nouvelle transaction"}</DialogTitle>
        <DialogDescription>
          Saisis le détail de cette ligne. Les imprévus sont taggés pour reporting.
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
        <form.AppField name="occurredOn">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-1">
              <FieldLabel>Date</FieldLabel>
              <FieldControl>
                <Input
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="amount">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-1">
              <FieldLabel>Montant (€)</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="0.01"
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

        <form.AppField name="label">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-2">
              <FieldLabel>Libellé</FieldLabel>
              <FieldControl>
                <Input
                  type="text"
                  placeholder="Ex. Carrefour, Salaire mai…"
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
            <Field className="col-span-1">
              <FieldLabel>Type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as "inflow" | "outflow")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">Entrée</SelectItem>
                  <SelectItem value="outflow">Sortie</SelectItem>
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="category">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-1">
              <FieldLabel>Catégorie</FieldLabel>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TRANSACTION_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="isImprevu">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field className="col-span-2 flex-row items-center gap-2">
              <input
                id="isImprevu"
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
                className="size-4 accent-amber-500"
              />
              <FieldLabel className="cursor-pointer" htmlFor="isImprevu">
                Marquer comme imprévu (one-shot, hors plan)
              </FieldLabel>
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
