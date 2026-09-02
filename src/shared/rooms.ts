import type { QuoteRoom, Surface } from './types'

/**
 * Standard openings deducted from wall area when measuring a room.
 *
 * A door is roughly 3ft by 7ft and a window roughly 3ft by 5ft. These are approximations
 * a painter would recognise, and they exist so a measured room does not over-report wall
 * area. Every number stays overridable, because the contractor owns the quantity.
 */
export const DOOR_SQFT = 21
export const WINDOW_SQFT = 15

export interface RoomDimensions {
  lengthFt: number
  widthFt: number
  heightFt: number
  doors: number
  windows: number
}

export interface RoomSurfaces {
  wallSqft: number
  ceilingSqft: number
  trimLinft: number
}

const round1 = (n: number) => Math.round(n * 10) / 10
const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
const safeCount = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/**
 * Derives paintable surface areas from room dimensions.
 *
 * Walls are the perimeter times the height, less openings. Ceiling is the floor area.
 * Trim is the perimeter, which is the baseboard run. Wall area is floored at zero: a
 * small room with many openings can compute negative, and a negative quantity would
 * subtract money from the quote.
 */
export function roomFromDimensions(input: RoomDimensions): RoomSurfaces {
  const length = safe(input.lengthFt)
  const width = safe(input.widthFt)
  const height = safe(input.heightFt)

  const perimeter = 2 * (length + width)
  const openings = safeCount(input.doors) * DOOR_SQFT + safeCount(input.windows) * WINDOW_SQFT

  return {
    wallSqft: round1(Math.max(0, perimeter * height - openings)),
    ceilingSqft: round1(length * width),
    trimLinft: round1(perimeter),
  }
}

/**
 * Sums every room into the quantities a quote needs, with coats applied.
 *
 * Wall and ceiling rates are per coat, so two coats over the same wall is twice the area.
 * Trim is a linear run of baseboard: coating it twice does not make it longer, so coats
 * deliberately do not multiply it.
 */
export function totalsForRooms(rooms: QuoteRoom[]): RoomSurfaces {
  return rooms.reduce<RoomSurfaces>(
    (sum, room) => {
      const coats = Number.isFinite(room.coats) && room.coats > 0 ? room.coats : 1
      return {
        wallSqft: round1(sum.wallSqft + safe(room.wallSqft) * coats),
        ceilingSqft: round1(sum.ceilingSqft + safe(room.ceilingSqft) * coats),
        trimLinft: round1(sum.trimLinft + safe(room.trimLinft)),
      }
    },
    { wallSqft: 0, ceilingSqft: 0, trimLinft: 0 },
  )
}

/** The quantity a line item should carry for a given surface, or null when unaffected. */
export function quantityForSurface(surface: Surface | null, totals: RoomSurfaces): number | null {
  if (surface === 'wall') return totals.wallSqft
  if (surface === 'ceiling') return totals.ceilingSqft
  if (surface === 'trim') return totals.trimLinft
  return null
}

/**
 * Gallons needed for a coated area, rounded up.
 *
 * Paint is sold in whole containers, so a job needing 2.1 gallons requires 3. Rounding
 * down would leave the painter buying the shortfall out of their own margin.
 */
export function gallonsFor(sqft: number, coverageSqftPerGallon: number): number {
  const area = safe(sqft)
  const coverage = safe(coverageSqftPerGallon)
  if (area === 0 || coverage === 0) return 0
  return Math.ceil(area / coverage)
}
