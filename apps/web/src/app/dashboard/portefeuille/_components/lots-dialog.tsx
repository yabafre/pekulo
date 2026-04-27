"use client"

import { useEffect, useState } from "react"
import { useActionMutation, useActionQuery } from "@zapaction/query"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldControl,
  FieldError,
  FieldLabel,
  Form,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { useAppForm } from "@/hooks/form-hook"
import {
  addHoldingLot,
  deleteHoldingLot,
  getHoldingLots,
} from "@/lib/actions/holding-lots"
import { lotInputSchema } from "@/lib/schemas/holding-lots"
import { lotsKeys, lotsTags, portfolioTags } from "@/lib/zapaction/keys"
import { deriveFromLots } from "@/lib/derive-lots"
import type { Holding, LotType } from "@/lib/types"

function formatNum(n: number, digits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function LotsDialog({
  open,
  onOpenChange,
  holding,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  holding: Holding | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && holding ? (
          <Body holding={holding} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ holding, onDone }: { holding: Holding; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const queryKey = lotsKeys.byHolding(holding.id)
  const lotsQuery = useActionQuery(getHoldingLots, {
    queryKey,
    input: { holdingId: holding.id },
    readPolicy: "read-only",
  })
  const lots = lotsQuery.data ?? []
  const derived = deriveFromLots(lots)
  const noLotsYet = lots.length === 0
  const canImportInitial =
    noLotsYet && holding.quantity > 0 && holding.avgCost > 0

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey })
    await queryClient.refetchQueries({ queryKey })
  }

  const addMutation = useActionMutation(addHoldingLot, {
    invalidateWithTags: [lotsTags.all(), portfolioTags.holdings()],
    onSuccess: handleSuccess,
  })
  const deleteMutation = useActionMutation(deleteHoldingLot, {
    invalidateWithTags: [lotsTags.all(), portfolioTags.holdings()],
    onSuccess: handleSuccess,
  })

  const today = new Date().toISOString().slice(0, 10)

  type LotForm = {
    type: LotType
    occurredOn: string
    quantity: number
    priceUnit: number
    fees: number
    notes: string
  }

  const form = useAppForm({
    defaultValues: {
      type: "buy" as LotType,
      occurredOn: today,
      quantity: 0,
      priceUnit: 0,
      fees: 0,
      notes: "",
    } as LotForm,
    onSubmit: async ({ value }) => {
      const payload = lotInputSchema.parse({
        holdingId: holding.id,
        ...value,
        notes: value.notes && value.notes.length > 0 ? value.notes : null,
      })
      await addMutation.mutateAsync(payload)
      form.reset({
        type: "buy",
        occurredOn: today,
        quantity: 0,
        priceUnit: 0,
        fees: 0,
        notes: "",
      })
    },
  })

  // Reset form when holding changes
  useEffect(() => {
    form.reset({
      type: "buy",
      occurredOn: today,
      quantity: 0,
      priceUnit: 0,
      fees: 0,
      notes: "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding.id])

  async function importInitial() {
    setBusy(true)
    try {
      await addMutation.mutateAsync(
        lotInputSchema.parse({
          holdingId: holding.id,
          type: "buy",
          occurredOn: today,
          quantity: holding.quantity,
          priceUnit: holding.avgCost,
          fees: 0,
          notes: "Lot initial (import depuis valeurs manuelles)",
        })
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form.AppForm>
      <DialogHeader>
        <DialogTitle>Historique — {holding.label}</DialogTitle>
        <DialogDescription>
          Saisis chaque achat / vente. Le prix moyen et la quantité du holding sont
          recalculés automatiquement (moyenne pondérée).
        </DialogDescription>
      </DialogHeader>

      {/* Live derived banner */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Total qty :</span>{" "}
            <span className="font-semibold tabular-nums">{formatNum(derived.quantity, 4)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Avg cost :</span>{" "}
            <span className="font-semibold tabular-nums">{formatNum(derived.avgCost, 2)} {holding.currency}</span>
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {lots.length} lot{lots.length > 1 ? "s" : ""}
          </span>
        </CardContent>
      </Card>

      {canImportInitial ? (
        <div className="text-xs px-3 py-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-2 flex-wrap">
          <span>
            Aucun lot enregistré, mais ce holding a déjà qty={formatNum(holding.quantity, 4)} avg={formatNum(holding.avgCost, 2)}.
            Tu peux les importer comme premier lot.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || addMutation.isPending}
            onClick={importInitial}
          >
            Import comme premier lot
          </Button>
        </div>
      ) : null}

      {/* Lots table */}
      {lots.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Prix unit.</TableHead>
                  <TableHead className="text-right">Frais</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((l) => {
                  const total = l.quantity * l.priceUnit + (l.type === "buy" ? l.fees : 0)
                  const isDeletingThis =
                    deleteMutation.isPending &&
                    deleteMutation.variables?.id === l.id
                  const rowDisabled = deleteMutation.isPending
                  return (
                    <TableRow
                      key={l.id}
                      className={isDeletingThis ? "opacity-50" : undefined}
                    >
                      <TableCell className="whitespace-nowrap">{l.occurredOn}</TableCell>
                      <TableCell>
                        <span
                          className={
                            "text-xs px-1.5 py-0.5 rounded font-medium " +
                            (l.type === "buy"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-destructive/10 text-destructive")
                          }
                        >
                          {l.type === "buy" ? "Achat" : "Vente"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNum(l.quantity, 4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNum(l.priceUnit, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatNum(l.fees, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNum(total, 2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteMutation.mutate({ id: l.id })}
                          aria-label="Supprimer le lot"
                          disabled={rowDisabled}
                          title="Supprimer le lot"
                        >
                          {isDeletingThis ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Add lot form */}
      <Form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2"
      >
        <form.AppField name="type">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as LotType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Achat</SelectItem>
                  <SelectItem value="sell">Vente</SelectItem>
                </SelectContent>
              </Select>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="occurredOn">
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

        <form.AppField name="quantity">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Quantité</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="0.0001"
                  value={field.state.value ?? 0}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber
                    field.handleChange(Number.isNaN(v) ? 0 : v)
                  }}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="priceUnit">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Prix unitaire ({holding.currency})</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="0.01"
                  value={field.state.value ?? 0}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber
                    field.handleChange(Number.isNaN(v) ? 0 : v)
                  }}
                  onBlur={field.handleBlur}
                />
              </FieldControl>
              <FieldError />
            </Field>
          )}
        </form.AppField>

        <form.AppField name="fees">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(field: any) => (
            <Field>
              <FieldLabel>Frais ({holding.currency})</FieldLabel>
              <FieldControl>
                <Input
                  type="number"
                  step="0.01"
                  value={field.state.value ?? 0}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber
                    field.handleChange(Number.isNaN(v) ? 0 : v)
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
            <Field>
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

        <div className="col-span-2 sm:col-span-3 flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onDone}>
            Fermer
          </Button>
          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => {
              const pending = addMutation.isPending || isSubmitting
              return (
                <Button type="submit" disabled={!canSubmit || pending}>
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Ajout…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter le lot
                    </>
                  )}
                </Button>
              )
            }}
          </form.Subscribe>
        </div>
      </Form>

      {(addMutation.isError || deleteMutation.isError) && (
        <p className="text-xs text-destructive">
          Erreur :{" "}
          {(addMutation.error as Error)?.message ??
            (deleteMutation.error as Error)?.message}
        </p>
      )}
    </form.AppForm>
  )
}
