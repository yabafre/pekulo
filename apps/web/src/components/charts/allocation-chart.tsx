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

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export interface AllocationDatum {
  label: string
  value: number
}

export function AllocationChart({ data }: { data: AllocationDatum[] }) {
  const filtered = data.filter((d) => d.value > 0)
  const total = filtered.reduce((acc, d) => acc + d.value, 0)

  const config = filtered.reduce<ChartConfig>((acc, item, i) => {
    acc[item.label] = { label: item.label, color: palette[i % palette.length] }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Allocation par compte</CardTitle>
        <CardDescription className="text-xs">
          Répartition cash + valeur titres par compte
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {filtered.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Aucun capital à allouer pour l&apos;instant.
          </div>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square h-[260px]">
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
                data={filtered}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {filtered.map((p, i) => (
                  <Cell key={p.label} fill={palette[i % palette.length]} />
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
                          Capital total
                        </tspan>
                      </text>
                    )
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
