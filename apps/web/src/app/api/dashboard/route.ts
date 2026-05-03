import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deriveAnnualSummaries,
  deriveBudget,
  deriveKpis,
  deriveMonthly,
  deriveRevenue,
  deriveScenarios,
} from "@/lib/derive";
import { readHypotheses } from "@/lib/data/hypotheses";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { hypotheses } = await readHypotheses();

    const { data: dbMonthly } = await supabase
      .from("monthly_tracking")
      .select("*")
      .eq("user_id", user.id)
      .order("month_num");

    const monthly = deriveMonthly(hypotheses);

    return NextResponse.json({
      kpi: deriveKpis(hypotheses),
      monthly: dbMonthly?.length ? dbMonthly : monthly,
      annual: deriveAnnualSummaries(hypotheses),
      scenarios: deriveScenarios(hypotheses),
      budget: deriveBudget(hypotheses),
      revenue: deriveRevenue(hypotheses),
    });
  } catch (e) {
    console.error("[/api/dashboard]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
