"use client"

import { Cell, Label, Pie, PieChart } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { BudgetItem } from "@/lib/types"

interface BudgetChartProps {
  data: BudgetItem[]
}

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function BudgetChart({ data }: BudgetChartProps) {
  const pieData = data.flatMap((item) => {
    if (item.sousItems?.length) {
      return item.sousItems.map((s) => ({ name: s.label, value: s.montant }))
    }
    return [{ name: item.categorie, value: item.montant }]
  })

  const total = pieData.reduce((acc, p) => acc + p.value, 0)

  const config = pieData.reduce<ChartConfig>((acc, item, i) => {
    acc[item.name] = { label: item.name, color: palette[i % palette.length] }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget Mensuel</CardTitle>
        <CardDescription className="text-xs">
          Répartition des charges + provision épargne
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={config} className="mx-auto aspect-square h-[280px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => [
                    new Intl.NumberFormat("fr-FR").format(Math.round(Number(value))) + " €",
                    name,
                  ]}
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={2}
              stroke="var(--card)"
            >
              {pieData.map((p, i) => (
                <Cell key={p.name} fill={palette[i % palette.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-xl font-semibold"
                      >
                        {new Intl.NumberFormat("fr-FR").format(Math.round(total))} €
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 18}
                        className="fill-muted-foreground text-xs"
                      >
                        Total mensuel
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
