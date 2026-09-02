import { describe, it, expect } from 'vitest'
import {
  roundCents,
  lineTotalCents,
  applyCoats,
  calculateTotals,
  formatCents,
  parsePriceToCents,
} from './pricing'

const line = (unitPriceCents: number, quantity: number, isPriceUnconfirmed = false) => ({
  unitPriceCents,
  quantity,
  isPriceUnconfirmed,
})

describe('roundCents', () => {
  it('rounds to the nearest cent', () => {
    expect(roundCents(100.4)).toBe(100)
    expect(roundCents(100.6)).toBe(101)
  })

  it('rounds a true half up', () => {
    expect(roundCents(100.5)).toBe(101)
  })

  it('recovers a half that floating point pushed just below the boundary', () => {
    // $1.75/sq ft over 2.3 units is 402.49999999999994 in IEEE 754, not 402.5.
    // Naive Math.round returns 402 and silently loses a cent.
    expect(175 * 2.3).toBeLessThan(402.5)
    expect(Math.round(175 * 2.3)).toBe(402)
    expect(roundCents(175 * 2.3)).toBe(403)
  })

  it('is safe on non-finite input', () => {
    expect(roundCents(Number.NaN)).toBe(0)
    expect(roundCents(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('lineTotalCents', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineTotalCents(line(175, 340))).toBe(59_500)
  })

  it('handles fractional quantities', () => {
    expect(lineTotalCents(line(6500, 1.5))).toBe(9750)
  })

  it('handles a zero quantity', () => {
    expect(lineTotalCents(line(1000, 0))).toBe(0)
  })
})

describe('applyCoats', () => {
  it('doubles area for two coats', () => {
    expect(applyCoats(340, 2)).toBe(680)
  })

  it('leaves a single coat unchanged', () => {
    expect(applyCoats(340, 1)).toBe(340)
  })

  it('treats fewer than one coat as no work', () => {
    expect(applyCoats(340, 0)).toBe(0)
  })
})

describe('calculateTotals', () => {
  it('sums line items into a subtotal', () => {
    const totals = calculateTotals({
      lineItems: [line(18_000, 1), line(12_000, 1), line(1500, 1)],
      taxRateBps: 0,
      jobMinimumCents: 0,
    })
    expect(totals.subtotalCents).toBe(31_500)
    expect(totals.totalCents).toBe(31_500)
  })

  it('applies tax at basis points', () => {
    // 8.25% of $315.00 is $25.9875, which rounds to $25.99.
    const totals = calculateTotals({
      lineItems: [line(31_500, 1)],
      taxRateBps: 825,
      jobMinimumCents: 0,
    })
    expect(totals.taxCents).toBe(2599)
    expect(totals.totalCents).toBe(34_099)
  })

  it('tops up to the job minimum when the subtotal falls short', () => {
    const totals = calculateTotals({
      lineItems: [line(15_000, 1)],
      taxRateBps: 0,
      jobMinimumCents: 25_000,
    })
    expect(totals.minimumAdjustmentCents).toBe(10_000)
    expect(totals.totalCents).toBe(25_000)
  })

  it('does not adjust when the subtotal already clears the minimum', () => {
    const totals = calculateTotals({
      lineItems: [line(40_000, 1)],
      taxRateBps: 0,
      jobMinimumCents: 25_000,
    })
    expect(totals.minimumAdjustmentCents).toBe(0)
    expect(totals.totalCents).toBe(40_000)
  })

  it('taxes the minimum top-up, not just the line items', () => {
    // The minimum is revenue the customer is charged, so it is taxable.
    // Taxing $150 instead of $250 here would under-collect by $8.25.
    const totals = calculateTotals({
      lineItems: [line(15_000, 1)],
      taxRateBps: 1000,
      jobMinimumCents: 25_000,
    })
    expect(totals.taxableCents).toBe(25_000)
    expect(totals.taxCents).toBe(2500)
    expect(totals.totalCents).toBe(27_500)
  })

  it('is zero across the board for an empty quote', () => {
    const totals = calculateTotals({ lineItems: [], taxRateBps: 825, jobMinimumCents: 0 })
    expect(totals).toMatchObject({
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      hasUnconfirmedPrices: false,
    })
  })

  it('flags a quote carrying any unconfirmed seed price', () => {
    const totals = calculateTotals({
      lineItems: [line(18_000, 1), line(12_000, 1, true)],
      taxRateBps: 0,
      jobMinimumCents: 0,
    })
    expect(totals.hasUnconfirmedPrices).toBe(true)
  })

  it('rounds tax once on the total, not per line', () => {
    // Three lines of $10.01 at 8.25%. Per-line rounding gives 83+83+83 = 249.
    // Rounding once on $30.03 gives 248. The single rounding is correct.
    const totals = calculateTotals({
      lineItems: [line(1001, 1), line(1001, 1), line(1001, 1)],
      taxRateBps: 825,
      jobMinimumCents: 0,
    })
    expect(totals.subtotalCents).toBe(3003)
    expect(totals.taxCents).toBe(248)
  })

  it('produces a realistic bathroom repaint end to end', () => {
    const totals = calculateTotals({
      lineItems: [
        line(175, 680), // walls, 340 sq ft at two coats, $1.75/sq ft
        line(4500, 1), // ceiling
        line(6500, 1.5), // prep, 1.5 hours
        line(3800, 2), // paint, 2 gallons
      ],
      taxRateBps: 825,
      jobMinimumCents: 20_000,
    })
    // 119000 walls + 4500 ceiling + 9750 prep + 7600 paint
    expect(totals.subtotalCents).toBe(140_850)
    expect(totals.minimumAdjustmentCents).toBe(0)
    expect(totals.taxCents).toBe(11_620)
    expect(totals.totalCents).toBe(152_470)
    expect(formatCents(totals.totalCents)).toBe('$1,524.70')
  })
})

describe('formatCents', () => {
  it('formats with a thousands separator and two decimals', () => {
    expect(formatCents(137_099)).toBe('$1,370.99')
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(5)).toBe('$0.05')
  })
})

describe('parsePriceToCents', () => {
  it('parses plain and decorated input alike', () => {
    expect(parsePriceToCents('12')).toBe(1200)
    expect(parsePriceToCents('12.50')).toBe(1250)
    expect(parsePriceToCents('$1,234.56')).toBe(123_456)
  })

  it('returns zero for empty or junk input rather than NaN', () => {
    expect(parsePriceToCents('')).toBe(0)
    expect(parsePriceToCents('abc')).toBe(0)
    expect(parsePriceToCents('.')).toBe(0)
  })

  it('does not lose a cent on a value floating point represents poorly', () => {
    expect(parsePriceToCents('1.15')).toBe(115)
    expect(parsePriceToCents('8.29')).toBe(829)
  })
})
