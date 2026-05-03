import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HoldingLot, LotType } from "@/lib/types";

export async function readHoldingLots(holdingId: string): Promise<HoldingLot[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("holding_lots")
      .select("*")
      .eq("user_id", user.id)
      .eq("holding_id", holdingId)
      .order("occurred_on", { ascending: true });

    if (error || !data) return [];
    return data.map(rowToLot);
  } catch {
    return [];
  }
}

function rowToLot(row: Record<string, unknown>): HoldingLot {
  return {
    id: String(row.id),
    holdingId: String(row.holding_id),
    type: row.type as LotType,
    occurredOn: String(row.occurred_on),
    quantity: Number(row.quantity),
    priceUnit: Number(row.price_unit),
    fees: Number(row.fees),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}
