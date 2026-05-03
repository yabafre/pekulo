"use client";

import { useMemo, useState } from "react";
import { useActionQuery } from "@zapaction/query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getMonthlyEntries } from "@/lib/actions/monthly";
import { projectMonth } from "@/lib/derive-monthly";
import { monthRange } from "@/lib/schemas/monthly";
import { monthlyKeys } from "@/lib/zapaction/keys";
import type { Hypotheses, MonthlyEntry, MonthlyMerged } from "@/lib/types";
import { MonthlyForm } from "./monthly-form";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €";
}

function formatSigned(n: number) {
  if (n === 0) return "—";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${formatEuro(Math.abs(n))}`;
}

export function MonthlyList({
  initialData,
  hypothesesSnapshot,
}: {
  initialData: MonthlyMerged[];
  hypothesesSnapshot: Hypotheses;
}) {
  const [editing, setEditing] = useState<MonthlyMerged | null>(null);

  const query = useActionQuery(getMonthlyEntries, {
    queryKey: monthlyKeys.list(),
    input: undefined,
    readPolicy: "read-only",
    initialData: initialData.filter((m) => m.source === "actual").map(stripMerged),
  });

  const merged = useMemo(() => {
    const actualByKey = new Map(
      (query.data ?? []).map((entry) => [`${entry.year}-${entry.monthNum}`, entry]),
    );
    return monthRange().map(({ year, monthNum, label }): MonthlyMerged => {
      const projected = projectMonth(hypothesesSnapshot, year, monthNum);
      const actual = actualByKey.get(`${year}-${monthNum}`);
      if (actual) {
        return {
          ...actual,
          monthLabel: label,
          source: "actual",
          projected,
          ecart: actual.epargneMois - projected.epargneMois,
        };
      }
      return { ...projected, source: "projected", projected, ecart: 0 };
    });
  }, [query.data, hypothesesSnapshot]);

  const totals = useMemo(() => {
    const actualMonths = merged.filter((m) => m.source === "actual");
    const totalEcart = actualMonths.reduce((acc, m) => acc + m.ecart, 0);
    return { count: actualMonths.length, totalEcart };
  }, [merged]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          {totals.count} mois saisi{totals.count > 1 ? "s" : ""} sur {merged.length}
        </span>
        <span>
          Écart cumulé :{" "}
          <span
            className={
              totals.totalEcart > 0
                ? "text-emerald-600 font-medium"
                : totals.totalEcart < 0
                  ? "text-destructive font-medium"
                  : ""
            }
          >
            {formatSigned(totals.totalEcart)}
          </span>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Projeté</TableHead>
                <TableHead className="text-right">Réel</TableHead>
                <TableHead className="text-right">Écart</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merged.map((row, i) => {
                const showYearBoundary = i > 0 && row.year !== merged[i - 1]!.year;
                return (
                  <TableRow
                    key={`${row.year}-${row.monthNum}`}
                    className={
                      showYearBoundary ? "border-t-2 border-t-muted-foreground/30" : undefined
                    }
                  >
                    <TableCell className="font-medium">{row.monthLabel}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatEuro(row.projected.epargneMois)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.source === "actual" ? formatEuro(row.epargneMois) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.source === "actual" ? (
                        <span
                          className={
                            row.ecart > 0
                              ? "text-emerald-600"
                              : row.ecart < 0
                                ? "text-destructive"
                                : ""
                          }
                        >
                          {formatSigned(row.ecart)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={row.source === "actual" ? "secondary" : "outline"}
                        size="xs"
                        onClick={() => setEditing(row)}
                      >
                        {row.source === "actual" ? "Modifier" : "Saisir"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MonthlyForm
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        row={editing}
      />
    </>
  );
}

function stripMerged(m: MonthlyMerged): MonthlyEntry {
  return {
    year: m.year,
    monthNum: m.monthNum,
    monthLabel: m.monthLabel,
    net: m.net,
    avantages: m.avantages,
    depenses: m.depenses,
    credit: m.credit,
    remote: m.remote,
    freelance: m.freelance,
    epargneMois: m.epargneMois,
  };
}
