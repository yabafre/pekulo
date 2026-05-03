import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MonthlyEntry } from "@/lib/types";

export async function readMonthlyEntries(): Promise<MonthlyEntry[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("monthly_tracking")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: true })
      .order("month_num", { ascending: true });

    if (error || !data) return [];

    return data.map(rowToEntry);
  } catch {
    return [];
  }
}

function rowToEntry(row: Record<string, unknown>): MonthlyEntry {
  return {
    year: Number(row.year),
    monthNum: Number(row.month_num),
    monthLabel: String(row.month_label ?? ""),
    net: Number(row.net),
    avantages: Number(row.avantages),
    depenses: Number(row.depenses),
    credit: Number(row.credit),
    remote: Number(row.remote),
    freelance: Number(row.freelance),
    epargneMois: Number(row.epargne_mois),
  };
}
