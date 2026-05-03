import { Card, CardContent } from "@/components/ui/card"

interface KpiCardProps {
  label: string
  value: string
  sub?: string
}

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
