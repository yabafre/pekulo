"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ScenarioItem } from "@/lib/types";

interface ScenarioChartProps {
  data: ScenarioItem[];
}

const config = {
  epargne: { label: "Capital versé", color: "var(--chart-1)" },
  perf: { label: "Gains marché", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ScenarioChart({ data }: ScenarioChartProps) {
  const [view, setView] = useState("comparison");

  const comparisonData = data.map((s) => ({
    name: s.name,
    epargne: s.epargne,
    perf: s.perf,
  }));

  const focused = data.find((d) => d.name === view) ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Scénarios — Atteindre 100 000 €</CardTitle>
        <CardDescription className="text-xs">Capital versé + gains marché à 5 ans</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <Tabs value={view} onValueChange={setView} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="comparison" className="flex-1 text-xs">
              Comparaison
            </TabsTrigger>
            {data.map((s) => (
              <TabsTrigger key={s.name} value={s.name} className="flex-1 text-xs">
                {s.name.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {view === "comparison" ? (
          <ChartContainer config={config} className="h-[280px] w-full">
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={42}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) => [
                      new Intl.NumberFormat("fr-FR").format(Math.round(Number(value))) + " €",
                      config[name as keyof typeof config]?.label ?? name,
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="epargne"
                stackId="a"
                fill="var(--color-epargne)"
                radius={[0, 0, 4, 4]}
              />
              <Bar dataKey="perf" stackId="a" fill="var(--color-perf)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            {focused ? (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {new Intl.NumberFormat("fr-FR").format(focused.capitalFin)} €
                </p>
                <p className="text-sm text-muted-foreground mt-1">Capital fin 5 ans</p>
                <div className="flex gap-8 mt-5 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Capital versé</p>
                    <p className="font-semibold tabular-nums mt-0.5">
                      {new Intl.NumberFormat("fr-FR").format(focused.epargne)} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Gains marché</p>
                    <p className="font-semibold tabular-nums mt-0.5 text-emerald-600">
                      +{new Intl.NumberFormat("fr-FR").format(focused.perf)} €
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-5">
                  {focused.moisEpargne1} €/mois × 12 → {focused.moisEpargne2} €/mois × 48 ·{" "}
                  {focused.taux}% perf/an
                </p>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
