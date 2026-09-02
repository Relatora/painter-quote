import { describe, it, expect } from 'vitest'
import {
  roomFromDimensions,
  totalsForRooms,
  quantityForSurface,
  gallonsFor,
  DOOR_SQFT,
  WINDOW_SQFT,
} from './rooms'
import type { QuoteRoom } from './types'

const room = (over: Partial<QuoteRoom>): QuoteRoom => ({
  id: 'r',
  quoteId: 'q',
  name: 'Room',
  wallSqft: 0,
  ceilingSqft: 0,
  trimLinft: 0,
  coats: 1,
  sortOrder: 0,
  createdAt: '',
  ...over,
})

describe('roomFromDimensions', () => {
  it('derives walls, ceiling, and trim from a plain box', () => {
    // 12 x 12 with an 8ft ceiling: perimeter 48, walls 384, ceiling 144, trim 48.
    const r = roomFromDimensions({ lengthFt: 12, widthFt: 12, heightFt: 8, doors: 0, windows: 0 })
    expect(r).toEqual({ wallSqft: 384, ceilingSqft: 144, trimLinft: 48 })
  })

  it('deducts doors and windows from wall area only', () => {
    const r = roomFromDimensions({ lengthFt: 12, widthFt: 12, heightFt: 8, doors: 1, windows: 2 })
    expect(r.wallSqft).toBe(384 - DOOR_SQFT - 2 * WINDOW_SQFT)
    // Openings are in the walls, so ceiling and baseboard run are untouched.
    expect(r.ceilingSqft).toBe(144)
    expect(r.trimLinft).toBe(48)
  })

  it('never returns negative wall area', () => {
    // A tiny room with absurd openings computes negative. A negative quantity would
    // subtract money from the quote.
    const r = roomFromDimensions({ lengthFt: 3, widthFt: 3, heightFt: 8, doors: 4, windows: 4 })
    expect(r.wallSqft).toBe(0)
  })

  it('handles a non square room', () => {
    // 10 x 14 at 9ft: perimeter 48, walls 432, ceiling 140.
    const r = roomFromDimensions({ lengthFt: 10, widthFt: 14, heightFt: 9, doors: 0, windows: 0 })
    expect(r).toEqual({ wallSqft: 432, ceilingSqft: 140, trimLinft: 48 })
  })

  it('is safe on zero and junk input', () => {
    expect(roomFromDimensions({ lengthFt: 0, widthFt: 0, heightFt: 0, doors: 0, windows: 0 })).toEqual(
      { wallSqft: 0, ceilingSqft: 0, trimLinft: 0 },
    )
    expect(
      roomFromDimensions({
        lengthFt: Number.NaN,
        widthFt: 12,
        heightFt: 8,
        doors: -3,
        windows: Number.NaN,
      }).wallSqft,
    ).toBe(192)
  })
})

describe('totalsForRooms', () => {
  it('sums rooms', () => {
    const totals = totalsForRooms([
      room({ wallSqft: 300, ceilingSqft: 100, trimLinft: 40 }),
      room({ wallSqft: 200, ceilingSqft: 50, trimLinft: 30 }),
    ])
    expect(totals).toEqual({ wallSqft: 500, ceilingSqft: 150, trimLinft: 70 })
  })

  it('multiplies wall and ceiling area by coats', () => {
    const totals = totalsForRooms([
      room({ wallSqft: 300, ceilingSqft: 100, trimLinft: 40, coats: 2 }),
    ])
    expect(totals.wallSqft).toBe(600)
    expect(totals.ceilingSqft).toBe(200)
  })

  it('does not multiply trim by coats', () => {
    // Trim is a linear run of baseboard. Coating it twice does not make it longer.
    const totals = totalsForRooms([room({ trimLinft: 40, coats: 3 })])
    expect(totals.trimLinft).toBe(40)
  })

  it('treats a zero or missing coat count as one', () => {
    expect(totalsForRooms([room({ wallSqft: 300, coats: 0 })]).wallSqft).toBe(300)
  })

  it('returns zeros for no rooms', () => {
    expect(totalsForRooms([])).toEqual({ wallSqft: 0, ceilingSqft: 0, trimLinft: 0 })
  })

  it('mixes coat counts across rooms correctly', () => {
    const totals = totalsForRooms([
      room({ wallSqft: 300, coats: 2 }),
      room({ wallSqft: 100, coats: 1 }),
    ])
    expect(totals.wallSqft).toBe(700)
  })
})

describe('quantityForSurface', () => {
  const totals = { wallSqft: 600, ceilingSqft: 200, trimLinft: 70 }

  it('routes each surface to its own total', () => {
    expect(quantityForSurface('wall', totals)).toBe(600)
    expect(quantityForSurface('ceiling', totals)).toBe(200)
    expect(quantityForSurface('trim', totals)).toBe(70)
  })

  it('leaves unlinked items alone', () => {
    // Doors, gallons, and fees are not driven by room measurements.
    expect(quantityForSurface(null, totals)).toBeNull()
  })
})

describe('gallonsFor', () => {
  it('rounds up to whole containers', () => {
    // Paint is sold in whole cans. Rounding down makes the painter buy the shortfall.
    expect(gallonsFor(700, 350)).toBe(2)
    expect(gallonsFor(701, 350)).toBe(3)
    expect(gallonsFor(1, 350)).toBe(1)
  })

  it('returns zero for no area', () => {
    expect(gallonsFor(0, 350)).toBe(0)
  })

  it('does not divide by zero coverage', () => {
    expect(gallonsFor(700, 0)).toBe(0)
  })
})
