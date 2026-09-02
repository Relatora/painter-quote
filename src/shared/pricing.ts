import type { QuoteLineItem, QuoteTotals } from './types'

/**
 * Round to whole cents.
 *
 * Quantities are REAL, so `unitPriceCents * quantity` is a float and can land just
 * below a .5 boundary that should round up: 175 * 3.3 is 577.4999999999999, not 577.5.
 * A relative epsilon nudge pulls those back before rounding. Math.round alone would
 * silently lose a cent on inputs a painter would consider exact.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  const nudged = value + Math.sign(value) * Math.abs(value) * Number.EPSILON * 4
  return Math.round(nudged)
}

/** Extended price for a single line, in cents. */
export function lineTotalCents(item: Pick<QuoteLineItem, 'unitPriceCents' | 'quantity'>): number {
  return roundCents(item.unitPriceCents * item.quantity)
}

/**
 * Paint coverage is per coat, so two coats over the same surface is twice the area.
 * Kept here rather than in the UI so the rule is tested and has one definition.
 */
export function applyCoats(baseQuantity: number, coats: number): number {
  if (!Number.isFinite(baseQuantity) || !Number.isFinite(coats)) return 0
  if (coats < 1) return 0
  return baseQuantity * coats
}

export interface TotalsInput {
  lineItems: Array<Pick<QuoteLineItem, 'unitPriceCents' | 'quantity' | 'isPriceUnconfirmed'>>
  taxRateBps: number
  jobMinimumCents: number
}

/**
 * The single source of truth for what a quote costs.
 *
 * Order matters: the job minimum tops the subtotal up BEFORE tax, because the minimum
 * is revenue the customer is charged, and revenue is taxable. Taxing before the
 * top-up would under-collect.
 */
export function calculateTotals(input: TotalsInput): QuoteTotals {
  const { lineItems, taxRateBps, jobMinimumCents } = input

  const subtotalCents = lineItems.reduce((sum, item) => sum + lineTotalCents(item), 0)

  const minimumAdjustmentCents =
    jobMinimumCents > subtotalCents ? jobMinimumCents - subtotalCents : 0

  const taxableCents = subtotalCents + minimumAdjustmentCents
  const taxCents = roundCents((taxableCents * taxRateBps) / 10_000)

  return {
    subtotalCents,
    minimumAdjustmentCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
    hasUnconfirmedPrices: lineItems.some((i) => i.isPriceUnconfirmed),
  }
}

/** Display helper. Cents in, "$1,234.56" out. */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/** Parse a user-typed price ("1,234.56", "$12", "12.5") into cents. NaN-safe. */
export function parsePriceToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) return 0
  return roundCents(value * 100)
}
