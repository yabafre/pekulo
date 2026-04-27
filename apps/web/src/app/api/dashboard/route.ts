import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  kpiData,
  monthlyData,
  annualSummaries,
  scenarios,
  budgetData,
  revenueData,
} from "@/lib/data"
import { deriveBudget, deriveKpis, deriveRevenue } from "@/lib/derive"
import { readHypotheses } from "@/lib/data/hypotheses"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { hypotheses } = await readHypotheses()

    const { data: dbMonthly } = await supabase
      .from("monthly_tracking")
      .select("*")
      .eq("user_id", user.id)
      .order("month_num")

    return NextResponse.json({
      kpi: deriveKpis(hypotheses, kpiData.capitalProjete, kpiData.objectif),
      monthly: dbMonthly?.length ? dbMonthly : monthlyData,
      annual: annualSummaries,
      scenarios,
      budget: deriveBudget(hypotheses),
      revenue: deriveRevenue(hypotheses),
    })
  } catch {
    return NextResponse.json({
      kpi: kpiData,
      monthly: monthlyData,
      annual: annualSummaries,
      scenarios,
      budget: budgetData,
      revenue: revenueData,
    })
  }
}
