"use client"

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
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
import type { MonthlyRecord } from "@/lib/types"

interface CapitalChartProps {
  data: MonthlyRecord[]
}

const config = {
  capital: { label: "Capital total", color: "var(--chart-1)" },
  epargne: { label: "Épargne (sans perf)", color: "var(--chart-3)" },
} satisfies ChartConfig

export function CapitalChart({ data }: CapitalChartProps) {
  const chartData = data
    .filter((_, i) => i % 3 === 0)
    .map((m) => ({
      mois: m.month.replace(" 20", " "),
      capital: m.capitalTotal,
      epargne: m.epargneCumul,
    }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Projection du Capital — 5 ans</CardTitle>
        <CardDescription className="text-xs">
          Croissance trimestrielle, avec et sans performance marché
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={config} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="capitalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-capital)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-capital)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="mois"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              interval={3}
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
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelClassName="text-xs"
                  formatter={(value, name) => [
                    new Intl.NumberFormat("fr-FR").format(Math.round(Number(value))) + " €",
                    config[name as keyof typeof config]?.label ?? name,
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="capital"
              stroke="var(--color-capital)"
              strokeWidth={2}
              fill="url(#capitalGradient)"
            />
            <Line
              type="monotone"
              dataKey="epargne"
              stroke="var(--color-epargne)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
