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
import { useAppForm } from "@/hooks/form-hook";
import { deleteMonthlyEntry, saveMonthlyEntry } from "@/lib/actions/monthly";
import { monthlyEntrySchema } from "@/lib/schemas/monthly";
import { monthlyKeys, monthlyTags } from "@/lib/zapaction/keys";
import type { MonthlyMerged } from "@/lib/types";

export function MonthlyForm({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MonthlyMerged | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {row ? <Body row={row} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ row, onDone }: { row: MonthlyMerged; onDone: () => void }) {
  const queryClient = useQueryClient();

  // Belt-and-suspenders: invalidateWithTags drives the tag-registry path, AND we
  // also invalidate + refetch the query key directly. Either path alone has been
  // unreliable (tags lost across "use server" wrap, or refetch not firing).
  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: monthlyKeys.list() });
    await queryClient.refetchQueries({ queryKey: monthlyKeys.list() });
    onDone();
  };

  const saveMutation = useActionMutation(saveMonthlyEntry, {
    invalidateWithTags: [monthlyTags.list()],
    onSuccess: handleSuccess,
  });
  const deleteMutation = useActionMutation(deleteMonthlyEntry, {
    invalidateWithTags: [monthlyTags.list()],
    onSuccess: handleSuccess,
  });

  const form = useAppForm({
    defaultValues: {
      year: row.year,
      monthNum: row.monthNum,
      net: row.net,
      avantages: row.avantages,
      depenses: row.depenses,
      credit: row.credit,
      remote: row.remote,
      freelance: row.freelance,
    },
    validators: { onChange: monthlyEntrySchema },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value);
    },
  });

  // re-seed form when the row prop changes (different month opened)
  useEffect(() => {
    form.reset({
      year: row.year,
      monthNum: row.monthNum,
      net: row.net,
      avantages: row.avantages,
      depenses: row.depenses,
      credit: row.credit,
      remote: row.remote,
      freelance: row.freelance,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.year, row.monthNum]);

  return (
    <form.AppForm>
      <DialogHeader>
        <DialogTitle>{row.monthLabel}</DialogTitle>
        <DialogDescription>
          {row.source === "actual"
            ? "Modifie tes valeurs réelles. Effacer remettra la projection."
            : "Saisis tes valeurs réelles pour ce mois."}
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
        <NumField form={form} name="net" label="Net (€)" step="10" />
        <NumField form={form} name="avantages" label="Avantages (€)" step="1" />
        <NumField form={form} name="depenses" label="Dépenses (€)" step="10" />
        <NumField form={form} name="credit" label="Crédit (€)" step="10" />
        <NumField form={form} name="remote" label="Remote (€)" step="50" />
        <NumField form={form} name="freelance" label="Freelance (€)" step="50" />

        <DialogFooter className="col-span-2">
          {row.source === "actual" ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ year: row.year, monthNum: row.monthNum })}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Suppression…
                </>
              ) : (
                "Effacer"
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

function NumField({
  form,
  name,
  label,
  step = "1",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  name: "net" | "avantages" | "depenses" | "credit" | "remote" | "freelance";
  label: string;
  step?: string;
}) {
  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <FieldControl>
            <Input
              type="number"
              step={step}
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
  );
}
