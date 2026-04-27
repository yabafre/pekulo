import "server-only"
import { createClient } from "@/lib/supabase/server"
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
} from "@/lib/types"

export interface ReadTransactionFilters {
  year?: number
  monthNum?: number
  type?: TransactionType
  categories?: TransactionCategory[]
  limit?: number
}

export async function readTransactions(
  filters: ReadTransactionFilters = {}
): Promise<Transaction[]> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .limit(filters.limit ?? 100)

    if (filters.year != null && filters.monthNum != null) {
      const start = `${filters.year}-${String(filters.monthNum).padStart(2, "0")}-01`
      const end = monthEnd(filters.year, filters.monthNum)
      query = query.gte("occurred_on", start).lte("occurred_on", end)
    } else if (filters.year != null) {
      query = query.gte("occurred_on", `${filters.year}-01-01`).lte("occurred_on", `${filters.year}-12-31`)
    }

    if (filters.type) query = query.eq("type", filters.type)
    if (filters.categories && filters.categories.length > 0) {
      query = query.in("category", filters.categories)
    }

    const { data, error } = await query
    if (error || !data) return []
    return data.map(rowToTransaction)
  } catch {
    return []
  }
}

function monthEnd(year: number, monthNum: number): string {
  const last = new Date(year, monthNum, 0).getDate()
  return `${year}-${String(monthNum).padStart(2, "0")}-${String(last).padStart(2, "0")}`
}

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    occurredOn: String(row.occurred_on),
    label: String(row.label),
    amount: Number(row.amount),
    type: row.type as TransactionType,
    category: row.category as TransactionCategory,
    isImprevu: Boolean(row.is_imprevu),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  }
}
