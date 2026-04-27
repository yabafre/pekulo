import { z } from "zod"

export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre"] as const
export const HOLDING_KINDS = ["etf", "action", "autre"] as const
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance Vie",
  autre: "Autre",
}

export const HOLDING_KIND_LABELS: Record<(typeof HOLDING_KINDS)[number], string> = {
  etf: "ETF",
  action: "Action",
  autre: "Autre",
}

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.enum(CURRENCIES),
  cashBalance: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
})

export type AccountInput = z.infer<typeof accountSchema>

export const holdingSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  kind: z.enum(HOLDING_KINDS),
  ticker: z.string().max(20).optional().nullable(),
  isin: z.string().max(20).optional().nullable(),
  label: z.string().min(1).max(120),
  currency: z.enum(CURRENCIES),
  quantity: z.number().min(0),
  avgCost: z.number().min(0),
  lastPrice: z.number().min(0),
  lastPriceAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

export type HoldingInput = z.infer<typeof holdingSchema>

export const updatePriceSchema = z.object({
  id: z.string().uuid(),
  lastPrice: z.number().min(0),
  lastPriceAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>

export const idSchema = z.object({ id: z.string().uuid() })
export type IdInput = z.infer<typeof idSchema>
