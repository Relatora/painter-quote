import type { Category, UnitType } from '../../shared/types'

export interface SeedItem {
  name: string
  description: string | null
  category: Category
  unitType: UnitType
  unitPriceCents: number
}

/**
 * Starter price book for residential painting.
 *
 * Every one of these is written into a new contractor's book with is_default = 1, which
 * renders it as a "your price?" placeholder rather than a real number. The contractor
 * confirms or overwrites each price the first time they use it, and the confirmation
 * clears the flag. The point is that a brand-new user can produce a complete quote on
 * day one without first entering forty line items: the book fills itself in through use.
 *
 * Rates are plausible US mid-market figures, NOT researched market data. They exist to be
 * corrected. Do not present them anywhere as recommended or benchmark pricing.
 */
export const SEED_PRICE_BOOK: SeedItem[] = [
  // ---- Labor: the painting itself. Wall and ceiling rates are PER COAT. ----
  {
    name: 'Interior walls',
    description: 'Per coat. Cut in and roll.',
    category: 'labor',
    unitType: 'sqft',
    unitPriceCents: 110,
  },
  {
    name: 'Ceilings',
    description: 'Per coat.',
    category: 'labor',
    unitType: 'sqft',
    unitPriceCents: 125,
  },
  {
    name: 'Trim and baseboard',
    description: 'Per coat, brushed.',
    category: 'labor',
    unitType: 'linft',
    unitPriceCents: 250,
  },
  {
    name: 'Crown molding',
    description: 'Per coat, brushed.',
    category: 'labor',
    unitType: 'linft',
    unitPriceCents: 350,
  },
  {
    name: 'Doors',
    description: 'Both sides, including jamb and casing.',
    category: 'labor',
    unitType: 'unit',
    unitPriceCents: 8500,
  },
  {
    name: 'Windows',
    description: 'Interior side, including sill and casing.',
    category: 'labor',
    unitType: 'unit',
    unitPriceCents: 4500,
  },
  {
    name: 'Exterior siding',
    description: 'Per coat, sprayed and back-rolled.',
    category: 'labor',
    unitType: 'sqft',
    unitPriceCents: 175,
  },
  {
    name: 'Exterior soffit and fascia',
    description: 'Per coat.',
    category: 'labor',
    unitType: 'linft',
    unitPriceCents: 375,
  },

  // ---- Prep: where painters most often lose money by under-scoping. ----
  {
    name: 'Patch and sand',
    description: 'Nail holes, dents, minor drywall repair.',
    category: 'prep',
    unitType: 'hour',
    unitPriceCents: 6500,
  },
  {
    name: 'Caulking',
    description: 'Gaps at trim, corners, and transitions.',
    category: 'prep',
    unitType: 'linft',
    unitPriceCents: 175,
  },
  {
    name: 'Masking and protection',
    description: 'Floors, fixtures, and furniture.',
    category: 'prep',
    unitType: 'hour',
    unitPriceCents: 6500,
  },
  {
    name: 'Wallpaper removal',
    description: 'Strip, wash, and prep substrate.',
    category: 'prep',
    unitType: 'sqft',
    unitPriceCents: 250,
  },
  {
    name: 'Popcorn ceiling removal',
    description: 'Scrape, skim, and sand smooth.',
    category: 'prep',
    unitType: 'sqft',
    unitPriceCents: 275,
  },
  {
    name: 'Priming',
    description: 'Spot or full prime over bare or stained substrate.',
    category: 'prep',
    unitType: 'sqft',
    unitPriceCents: 85,
  },
  {
    name: 'Pressure washing',
    description: 'Exterior surface preparation.',
    category: 'prep',
    unitType: 'sqft',
    unitPriceCents: 35,
  },

  // ---- Materials. Coverage is roughly 350 sq ft per gallon per coat. ----
  {
    name: 'Interior paint',
    description: 'Approx. 350 sq ft per gallon per coat.',
    category: 'material',
    unitType: 'gallon',
    unitPriceCents: 4500,
  },
  {
    name: 'Exterior paint',
    description: 'Approx. 300 sq ft per gallon per coat.',
    category: 'material',
    unitType: 'gallon',
    unitPriceCents: 5800,
  },
  {
    name: 'Primer',
    description: 'Approx. 300 sq ft per gallon.',
    category: 'material',
    unitType: 'gallon',
    unitPriceCents: 3800,
  },
  {
    name: 'Sundries',
    description: 'Caulk, tape, plastic, sandpaper, liners.',
    category: 'material',
    unitType: 'flat',
    unitPriceCents: 3500,
  },

  // ---- Fees. ----
  {
    name: 'Trip and setup',
    description: 'Mobilization to site.',
    category: 'fee',
    unitType: 'flat',
    unitPriceCents: 7500,
  },
  {
    name: 'High ceiling / stairwell access',
    description: 'Staging or ladder work above standard reach.',
    category: 'fee',
    unitType: 'flat',
    unitPriceCents: 15_000,
  },
]

/** Paint coverage in square feet per gallon, per coat. Used to suggest gallon counts. */
export const COVERAGE_SQFT_PER_GALLON = {
  interior: 350,
  exterior: 300,
  primer: 300,
} as const

/** Common room presets so dimension entry is two taps, not a measuring tape. */
export interface RoomPreset {
  name: string
  /** Paintable wall area in sq ft at an 8 ft ceiling, less a typical door and window. */
  wallSqft: number
  ceilingSqft: number
  trimLinft: number
}

export const ROOM_PRESETS: RoomPreset[] = [
  { name: 'Bathroom (5x8)', wallSqft: 190, ceilingSqft: 40, trimLinft: 26 },
  { name: 'Bedroom (10x12)', wallSqft: 330, ceilingSqft: 120, trimLinft: 44 },
  { name: 'Bedroom (12x12)', wallSqft: 360, ceilingSqft: 144, trimLinft: 48 },
  { name: 'Living room (14x18)', wallSqft: 480, ceilingSqft: 252, trimLinft: 64 },
  { name: 'Kitchen (10x14)', wallSqft: 350, ceilingSqft: 140, trimLinft: 48 },
  { name: 'Hallway (4x20)', wallSqft: 370, ceilingSqft: 80, trimLinft: 48 },
  { name: 'Stairwell', wallSqft: 300, ceilingSqft: 0, trimLinft: 40 },
]
