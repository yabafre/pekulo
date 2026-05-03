"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useActionMutation, useActionQuery } from "@zapaction/query";
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
import { deleteHolding, saveHolding, updateHoldingPrice } from "@/lib/actions/portfolio";
import { getHoldingLots } from "@/lib/actions/holding-lots";
import {
  CURRENCIES,
  HOLDING_KINDS,
  HOLDING_KIND_LABELS,
  holdingSchema,
  updatePriceSchema,
} from "@/lib/schemas/portfolio";
import { lotsKeys, portfolioKeys, portfolioTags } from "@/lib/zapaction/keys";
import type { Account, Currency, Holding, HoldingKind } from "@/lib/types";

export function HoldingForm({
  open,
  onOpenChange,
  editing,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Holding | null;
  accounts: Account[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <Body editing={editing} accounts={accounts} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  editing,
  accounts,
  onDone,
}: {
  editing: Holding | null;
  accounts: Account[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.holdings() });
    await queryClient.refetchQueries({ queryKey: portfolioKeys.holdings() });
    onDone();
  };

  const saveMutation = useActionMutation(saveHolding, {
    invalidateWithTags: [portfolioTags.holdings()],
    onSuccess: handleSuccess,
  });
  const deleteMutation = useActionMutation(deleteHolding, {
    invalidateWithTags: [portfolioTags.holdings()],
    onSuccess: handleSuccess,
  });

  // When editing an existing holding, fetch its lots to know if qty/avgCost are derived.
  // For "new" holdings (editing === null), we never have lots → fetch is skipped.
  const lotsQuery = useActionQuery(getHoldingLots, {
    queryKey: editing ? lotsKeys.byHolding(editing.id) : ["lots", "noop"],
    input: { holdingId: editing?.id ?? "00000000-0000-0000-0000-000000000000" },
    readPolicy: "read-only",
    enabled: !!editing,
  });
  const hasLots = (lotsQuery.data?.length ?? 0) > 0;

  type FormValues = {
    id: string | undefined;
    accountId: string;
    kind: HoldingKind;
    ticker: string;
    isin: string;
    label: string;
    currency: Currency;
    quantity: number;
    avgCost: number;
    lastPrice: number;
    lastPriceAt: string;
    notes: string;
  };

  const initial: FormValues = editing
    ? {
        id: editing.id,
        accountId: editing.accountId,
        kind: editing.kind,
        ticker: editing.ticker ?? "",
        isin: editing.isin ?? "",
        label: editing.label,
        currency: editing.currency,
        quantity: editing.quantity,
        avgCost: editing.avgCost,
        lastPrice: editing.lastPrice,
        lastPriceAt: editing.lastPriceAt ?? "",
        notes: editing.notes ?? "",
      }
    : {
        id: undefined,
        accountId: accounts[0]?.id ?? "",
        kind: "etf",
        ticker: "",
        isin: "",
        label: "",
        currency: "EUR",
        quantity: 0,
        avgCost: 0,
        lastPrice: 0,
        lastPriceAt: "",
        notes: "",
      };

  const form = useAppForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const payload = holdingSchema.parse({
        ...value,
        ticker: value.ticker.length > 0 ? value.ticker : null,
        isin: value.isin.length > 0 ? value.isin : null,
        lastPriceAt: value.lastPriceAt.length > 0 ? value.lastPriceAt : null,
        notes: value.notes.length > 0 ? value.notes : null,
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
        <DialogTitle>{editing ? "Modifier la position" : "Nouvelle position"}</DialogTitle>
        <DialogDescription>
          ETF, action ou autre. Le prix moyen et le cours sont saisis manuellement pour le moment.
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
                  placeholder="Ex. Amundi MSCI World UCITS"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="accountId">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Compte</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  field.handleChange(v);
                  // Auto-fill currency from the chosen account.
                  const acc = accounts.find((a) => a.id === v);
                  if (acc) form.setFieldValue("currency", acc.currency);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un compte">
                    {(value: string) => accounts.find((a) => a.id === value)?.label ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="kind">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as HoldingKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLDING_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {HOLDING_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="ticker">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Ticker (optionnel)</FieldLabel>
              <FieldControl>
                <Input
                  type="text"
                  placeholder="CW8.PA"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="isin">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>ISIN (optionnel)</FieldLabel>
              <FieldControl>
                <Input
                  type="text"
                  placeholder="LU1681043599"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
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

        <form.AppField name="quantity">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Quantité{hasLots ? " (calculée)" : ""}</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="0.0001"
                  value={field.state.value ?? 0}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    field.handleChange(Number.isNaN(v) ? 0 : v);
                  }}
                  onBlur={field.handleBlur}
                  disabled={hasLots}
                  title={hasLots ? "Calculé depuis l'historique des lots" : undefined}
                />
              </FieldControl>
              <FieldError />
              {hasLots ? (
                <p className="text-xs text-muted-foreground">
                  Calculé depuis l&apos;historique des lots
                </p>
              ) : null}
            </Field>
          )}
        </form.AppField>

        <form.AppField name="avgCost">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Prix moyen{hasLots ? " (calculé)" : ""}</FieldLabel>
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
                  disabled={hasLots}
                  title={hasLots ? "Calculé depuis l'historique des lots" : undefined}
                />
              </FieldControl>
              <FieldError />
              {hasLots ? (
                <p className="text-xs text-muted-foreground">
                  Moyenne pondérée des achats / ventes
                </p>
              ) : null}
            </Field>
          )}
        </form.AppField>

        <form.AppField name="lastPrice">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Cours actuel</FieldLabel>
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

        <form.AppField name="lastPriceAt">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Date du cours</FieldLabel>
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

// ---------- Inline price update dialog ----------

export function PriceForm({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Holding | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && target ? <PriceBody target={target} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PriceBody({ target, onDone }: { target: Holding; onDone: () => void }) {
  const queryClient = useQueryClient();

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.holdings() });
    await queryClient.refetchQueries({ queryKey: portfolioKeys.holdings() });
    onDone();
  };

  const mutation = useActionMutation(updateHoldingPrice, {
    invalidateWithTags: [portfolioTags.holdings()],
    onSuccess: handleSuccess,
  });

  const today = new Date().toISOString().slice(0, 10);

  const form = useAppForm({
    defaultValues: {
      lastPrice: target.lastPrice,
      lastPriceAt: target.lastPriceAt ?? today,
    },
    onSubmit: async ({ value }) => {
      const payload = updatePriceSchema.parse({
        id: target.id,
        lastPrice: value.lastPrice,
        lastPriceAt: value.lastPriceAt,
      });
      await mutation.mutateAsync(payload);
    },
  });

  useEffect(() => {
    form.reset({
      lastPrice: target.lastPrice,
      lastPriceAt: target.lastPriceAt ?? today,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id]);

  return (
    <form.AppForm>
      <DialogHeader>
        <DialogTitle>Mettre à jour le cours</DialogTitle>
        <DialogDescription>{target.label}</DialogDescription>
      </DialogHeader>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <form.AppField name="lastPrice">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Cours</FieldLabel>
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

        <form.AppField name="lastPriceAt">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
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

        <DialogFooter className="col-span-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => {
              const pending = mutation.isPending || isSubmitting;
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

      {mutation.isError && (
        <p className="text-xs text-destructive">Erreur : {(mutation.error as Error).message}</p>
      )}
    </form.AppForm>
  );
}
