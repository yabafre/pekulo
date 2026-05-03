"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnnualSummary } from "@/lib/types";

interface AnnualSummaryChartProps {
  data: AnnualSummary[];
}

const config = {
  epargneAnnuelle: { label: "Épargne versée", color: "var(--chart-1)" },
  perfMarche: { label: "Gains marché", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function AnnualSummaryChart({ data }: AnnualSummaryChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Résumé Annuel — Capital par période</CardTitle>
        <CardDescription className="text-xs">
          Versements et performance marché empilés, année par année
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={config} className="h-[260px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="periode"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => v.replace("→ ", "→\n")}
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
              dataKey="epargneAnnuelle"
              stackId="a"
              fill="var(--color-epargneAnnuelle)"
              radius={[0, 0, 4, 4]}
            />
            <Bar
              dataKey="perfMarche"
              stackId="a"
              fill="var(--color-perfMarche)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
