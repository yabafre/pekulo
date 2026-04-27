import { z } from "zod"

export const lotTypeSchema = z.enum(["buy", "sell"])

export const lotInputSchema = z.object({
  holdingId: z.string().uuid(),
  type: lotTypeSchema,
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD requise"),
  quantity: z.number().positive("Quantité > 0 requise"),
  priceUnit: z.number().min(0, "Prix unitaire ≥ 0"),
  fees: z.number().min(0, "Frais ≥ 0"),
  notes: z.string().max(300).optional().nullable(),
})

export type LotInput = z.infer<typeof lotInputSchema>

export const lotIdSchema = z.object({ id: z.string().uuid() })
export type LotId = z.infer<typeof lotIdSchema>

export const lotListFilterSchema = z.object({
  holdingId: z.string().uuid(),
})
export type LotListFilter = z.infer<typeof lotListFilterSchema>
