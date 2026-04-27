"use client"

import { useMemo, useState } from "react"
import { useActionQuery } from "@zapaction/query"
import { Plus, Pencil } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getTransactions } from "@/lib/actions/transactions"
import { TRANSACTION_CATEGORY_LABELS } from "@/lib/schemas/transactions"
import { transactionsKeys } from "@/lib/zapaction/keys"
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
} from "@/lib/types"
import { TransactionForm } from "./transaction-form"

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €"
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]

export function TransactionsList({
  initialData,
  defaultYear,
  defaultMonth,
}: {
  initialData: Transaction[]
  defaultYear: number
  defaultMonth: number
}) {
  const [year, setYear] = useState(defaultYear)
  const [monthNum, setMonthNum] = useState<number | "all">(defaultMonth)
  const [type, setType] = useState<TransactionType | "all">("all")
  const [editing, setEditing] = useState<Transaction | "new" | null>(null)

  const filterInput = useMemo(
    () => ({
      year,
      monthNum: monthNum === "all" ? undefined : monthNum,
      type: type === "all" ? undefined : type,
      limit: 100,
    }),
    [year, monthNum, type]
  )

  const queryKey = useMemo(
    () => [
      ...transactionsKeys.list(),
      year,
      monthNum,
      type,
    ],
    [year, monthNum, type]
  )

  const query = useActionQuery(getTransactions, {
    queryKey,
    input: filterInput,
    readPolicy: "read-only",
    initialData: monthNum === defaultMonth && year === defaultYear && type === "all" ? initialData : undefined,
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  const totals = useMemo(() => {
    let inflow = 0
    let outflow = 0
    let imprevuInflow = 0
    let imprevuOutflow = 0
    for (const t of rows) {
      if (t.type === "inflow") {
        inflow += t.amount
        if (t.isImprevu) imprevuInflow += t.amount
      } else {
        outflow += t.amount
        if (t.isImprevu) imprevuOutflow += t.amount
      }
    }
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      imprevuInflow,
      imprevuOutflow,
    }
  }, [rows])

  const years = useMemo(() => {
    const out: number[] = []
    for (let y = 2026; y <= 2031; y++) out.push(y)
    return out
  }, [])

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Entrées" value={formatEuro(totals.inflow)} accent="emerald" />
        <Kpi label="Sorties" value={formatEuro(totals.outflow)} accent="destructive" />
        <Kpi
          label="Net"
          value={formatEuro(totals.net)}
          accent={totals.net >= 0 ? "emerald" : "destructive"}
        />
        <Kpi
          label="Imprévus (sorties)"
          value={formatEuro(totals.imprevuOutflow)}
          accent="muted"
          sub={
            totals.imprevuInflow > 0
              ? `+ ${formatEuro(totals.imprevuInflow)} entrées`
              : undefined
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={monthNum === "all" ? "all" : String(monthNum)}
          onValueChange={(v) => setMonthNum(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les mois</SelectItem>
            {MONTHS.map((label, i) => (
              <SelectItem key={label} value={String(i + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type}
          onValueChange={(v) => setType(v as TransactionType | "all")}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="inflow">Entrées</SelectItem>
            <SelectItem value="outflow">Sorties</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle transaction
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              {query.isLoading ? "Chargement…" : "Aucune transaction sur cette période."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.occurredOn)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.label}</div>
                      {row.notes && (
                        <div className="text-xs text-muted-foreground">{row.notes}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {TRANSACTION_CATEGORY_LABELS[row.category as TransactionCategory]}
                        {row.isImprevu && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                            imprévu
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell
                      className={
                        "text-right font-medium " +
                        (row.type === "inflow" ? "text-emerald-600" : "text-destructive")
                      }
                    >
                      {row.type === "inflow" ? "+" : "−"}
                      {formatEuro(row.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditing(row)}
                          aria-label="Modifier"
                        >
                          <Pencil />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        editing={editing === "new" ? null : editing}
        defaultDate={`${year}-${String(monthNum === "all" ? defaultMonth : monthNum).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`}
      />
    </>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: "emerald" | "destructive" | "muted"
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "destructive"
        ? "text-destructive"
        : "text-foreground"
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

