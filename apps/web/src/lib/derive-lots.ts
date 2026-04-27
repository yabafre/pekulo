import type { HoldingLot } from "./types"

export interface DerivedHoldingState {
  quantity: number
  avgCost: number
}

/**
 * Compute (quantity, avgCost) for a holding from its lot history.
 *
 * Weighted-average cost basis:
 *   - Buy:  cost  += qty × price + fees
 *           qty   += lot.qty
 *   - Sell: cost  -= sell.qty × (cost / qty)   (proportional)
 *           qty   -= sell.qty
 *           Fees on sells are treated as expenses (not added back to cost).
 *
 * Lots are processed in ascending `occurredOn` order, with `createdAt` as tie-break.
 * Returns { quantity: 0, avgCost: 0 } for an empty list.
 */
export function deriveFromLots(lots: HoldingLot[]): DerivedHoldingState {
  if (lots.length === 0) return { quantity: 0, avgCost: 0 }

  const sorted = [...lots].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1
    return a.createdAt < b.createdAt ? -1 : 1
  })

  let qty = 0
  let cost = 0

  for (const lot of sorted) {
    if (lot.type === "buy") {
      cost += lot.quantity * lot.priceUnit + lot.fees
      qty += lot.quantity
    } else {
      // sell: proportional cost reduction
      const avg = qty > 0 ? cost / qty : 0
      cost -= lot.quantity * avg
      qty -= lot.quantity
      // Avoid negative drift from over-sells / floating point.
      if (qty < 0) qty = 0
      if (cost < 0) cost = 0
    }
  }

  const safeQty = Math.max(0, qty)
  const avgCost = safeQty > 0 ? cost / safeQty : 0
  return { quantity: round(safeQty, 6), avgCost: round(avgCost, 6) }
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}
