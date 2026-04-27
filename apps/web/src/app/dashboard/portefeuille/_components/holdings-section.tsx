"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, RefreshCw, Sparkles, History } from "lucide-react"
import { useActionMutation } from "@zapaction/query"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HOLDING_KIND_LABELS } from "@/lib/schemas/portfolio"
import {
  refreshAllPrices,
  refreshHoldingPrice,
} from "@/lib/actions/portfolio"
import { portfolioKeys, portfolioTags } from "@/lib/zapaction/keys"
import type {
  Account,
  Holding,
  HoldingKind,
  RefreshSummary,
} from "@/lib/types"
import { HoldingForm } from "./holding-form"
import { LotsDialog } from "./lots-dialog"

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €"
}

function formatSigned(n: number) {
  if (n === 0) return "0 €"
  const sign = n > 0 ? "+" : "−"
  return `${sign}${formatEuro(Math.abs(n))}`
}

export function HoldingsSection({
  accounts,
  holdings,
  editing,
  setEditing,
}: {
  accounts: Account[]
  holdings: Holding[]
  editing: string | "new" | null
  setEditing: (v: string | "new" | null) => void
}) {
  const queryClient = useQueryClient()
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerKind, setBannerKind] = useState<"success" | "error" | "mixed">(
    "success"
  )

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.holdings() })
    await queryClient.refetchQueries({ queryKey: portfolioKeys.holdings() })
  }

  const refreshOne = useActionMutation(refreshHoldingPrice, {
    invalidateWithTags: [portfolioTags.holdings()],
    onSuccess: async (_data, vars) => {
      await invalidate()
      const h = holdings.find((x) => x.id === vars.id)
      setBannerKind("success")
      setBanner(`${h?.label ?? "Position"} mis à jour`)
    },
    onError: (err) => {
      setBannerKind("error")
      setBanner(`Échec : ${(err as Error).message}`)
    },
  })

  const refreshAll = useActionMutation(refreshAllPrices, {
    invalidateWithTags: [portfolioTags.holdings()],
    onSuccess: async (data: RefreshSummary) => {
      await invalidate()
      if (data.failed.length === 0) {
        setBannerKind("success")
        setBanner(`${data.updated} position${data.updated > 1 ? "s" : ""} mise${data.updated > 1 ? "s" : ""} à jour`)
      } else if (data.updated === 0) {
        setBannerKind("error")
        setBanner(
          `Tout a échoué — ${data.failed.map((f) => `${f.label} (${f.reason})`).join(", ")}`
        )
      } else {
        setBannerKind("mixed")
        setBanner(
          `${data.updated} OK, ${data.failed.length} échec${data.failed.length > 1 ? "s" : ""} — ${data.failed.map((f) => `${f.label}: ${f.reason}`).join(" · ")}`
        )
      }
    },
    onError: (err) => {
      setBannerKind("error")
      setBanner(`Échec : ${(err as Error).message}`)
    },
  })

  // Banner auto-clear after 4s
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(t)
  }, [banner])

  const editingHolding =
    editing && editing !== "new" ? holdings.find((h) => h.id === editing) ?? null : null
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const anyTicker = holdings.some((h) => h.ticker && h.ticker.length > 0)
  const refreshAllPending = refreshAll.isPending
  const [lotsHoldingId, setLotsHoldingId] = useState<string | null>(null)
  const lotsHolding = lotsHoldingId
    ? holdings.find((h) => h.id === lotsHoldingId) ?? null
    : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base">Positions</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshAll.mutate(undefined)}
            disabled={!anyTicker || refreshAllPending}
            title={
              !anyTicker
                ? "Aucune position avec ticker"
                : "Refresh prix Yahoo Finance"
            }
          >
            <Sparkles className={`h-4 w-4 mr-1 ${refreshAllPending ? "animate-pulse" : ""}`} />
            {refreshAllPending ? "Refresh…" : "Refresh tous"}
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing("new")}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? "Crée d’abord un compte" : undefined}
          >
            <Plus className="h-4 w-4 mr-1" /> Nouvelle position
          </Button>
        </div>
      </CardHeader>

      {banner && (
        <div className="px-6 -mt-2 mb-2">
          <div
            className={
              "text-xs px-3 py-2 rounded-md " +
              (bannerKind === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : bannerKind === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400")
            }
          >
            {banner}
          </div>
        </div>
      )}

      <CardContent className="p-0">
        {holdings.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            Aucune position. Ajoute un ETF ou une action liée à un compte titres.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Prix moyen</TableHead>
                <TableHead className="text-right">Cours</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const value = h.quantity * h.lastPrice
                const invested = h.quantity * h.avgCost
                const pl = value - invested
                const account = accountById.get(h.accountId)
                const hasTicker = !!(h.ticker && h.ticker.length > 0)
                const isPendingRow =
                  refreshOne.isPending && refreshOne.variables?.id === h.id
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      {h.label}
                      <div className="text-xs text-muted-foreground">
                        {[h.ticker, h.isin].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account?.label ?? "—"}
                    </TableCell>
                    <TableCell>{HOLDING_KIND_LABELS[h.kind as HoldingKind]}</TableCell>
                    <TableCell className="text-right">{h.quantity}</TableCell>
                    <TableCell className="text-right">{formatEuro(h.avgCost)}</TableCell>
                    <TableCell className="text-right">
                      {formatEuro(h.lastPrice)}
                      {h.lastPriceAt && (
                        <div className="text-xs text-muted-foreground">{h.lastPriceAt}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatEuro(value)}</TableCell>
                    <TableCell
                      className={
                        "text-right font-medium " +
                        (pl > 0 ? "text-emerald-600" : pl < 0 ? "text-destructive" : "")
                      }
                    >
                      {formatSigned(pl)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => refreshOne.mutate({ id: h.id })}
                          disabled={!hasTicker || isPendingRow || refreshAllPending}
                          aria-label="Refresh prix"
                          title={
                            !hasTicker
                              ? "Ajouter un ticker pour activer"
                              : "Refresh prix Yahoo Finance"
                          }
                        >
                          <RefreshCw
                            className={isPendingRow ? "animate-spin" : undefined}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setLotsHoldingId(h.id)}
                          aria-label="Historique"
                          title="Historique des lots (achats / ventes)"
                        >
                          <History />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditing(h.id)}
                          aria-label="Modifier"
                          title="Modifier (saisie manuelle)"
                        >
                          <Pencil />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <HoldingForm
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        editing={editingHolding}
        accounts={accounts}
      />

      <LotsDialog
        open={lotsHoldingId !== null}
        onOpenChange={(open) => {
          if (!open) setLotsHoldingId(null)
        }}
        holding={lotsHolding}
      />
    </Card>
  )
}
