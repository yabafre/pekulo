"use server"

import { defineAction } from "@zapaction/core"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  transactionFiltersSchema,
  transactionIdSchema,
  transactionInputSchema,
} from "@/lib/schemas/transactions"
import { transactionsTags } from "@/lib/zapaction/keys"
import type { ActionContext } from "@/lib/zapaction/context"
import "@/lib/zapaction/context"
import type { Transaction, TransactionCategory, TransactionType } from "@/lib/types"

const rowToTransaction = (row: Record<string, unknown>): Transaction => ({
  id: String(row.id),
  occurredOn: String(row.occurred_on),
  label: String(row.label),
  amount: Number(row.amount),
  type: row.type as TransactionType,
  category: row.category as TransactionCategory,
  isImprevu: Boolean(row.is_imprevu),
  notes: row.notes != null ? String(row.notes) : null,
  createdAt: String(row.created_at),
})

export const getTransactions = defineAction<
  z.infer<typeof transactionFiltersSchema>,
  Transaction[],
  ActionContext
>({
  name: "getTransactions",
  input: transactionFiltersSchema,
  handler: async ({ input, ctx }) => {
    let query = ctx.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("occurred_on", { ascending: false })
      .limit(input.limit ?? 100)

    if (input.year != null && input.monthNum != null) {
      const start = `${input.year}-${String(input.monthNum).padStart(2, "0")}-01`
      const lastDay = new Date(input.year, input.monthNum, 0).getDate()
      const end = `${input.year}-${String(input.monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      query = query.gte("occurred_on", start).lte("occurred_on", end)
    } else if (input.year != null) {
      query = query.gte("occurred_on", `${input.year}-01-01`).lte("occurred_on", `${input.year}-12-31`)
    }
    if (input.type) query = query.eq("type", input.type)
    if (input.categories && input.categories.length > 0) {
      query = query.in("category", input.categories)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(rowToTransaction)
  },
})

export const saveTransaction = defineAction<
  z.infer<typeof transactionInputSchema>,
  Transaction,
  ActionContext
>({
  name: "saveTransaction",
  input: transactionInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input, ctx }) => {
    const payload = {
      user_id: ctx.userId,
      occurred_on: input.occurredOn,
      label: input.label,
      amount: input.amount,
      type: input.type,
      category: input.category,
      is_imprevu: input.isImprevu,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = input.id
      ? await ctx.supabase
          .from("transactions")
          .update(payload)
          .eq("id", input.id)
          .eq("user_id", ctx.userId)
          .select("*")
          .single()
      : await ctx.supabase
          .from("transactions")
          .insert(payload)
          .select("*")
          .single()
    if (error) throw error
    revalidatePath("/dashboard/transactions")
    revalidatePath("/dashboard")
    return rowToTransaction(data)
  },
})

export const deleteTransaction = defineAction<
  z.infer<typeof transactionIdSchema>,
  { ok: true },
  ActionContext
>({
  name: "deleteTransaction",
  input: transactionIdSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from("transactions")
      .delete()
      .eq("id", input.id)
      .eq("user_id", ctx.userId)
    if (error) throw error
    revalidatePath("/dashboard/transactions")
    revalidatePath("/dashboard")
    return { ok: true as const }
  },
})
