import type { Category, UnitType, Surface } from '../../shared/types'

export interface SeedItem {
  name: string
  description: string | null
  category: Category
  unitType: UnitType
  unitPriceCents: number
  /** Set from SURFACE_BY_NAME below, so the mapping lives in exactly one place. */
  surface?: Surface | null
}

/**
 * Which surface each seeded item coats, so room measurements can fan out onto line items
 * without matching on names at runtime. Anything absent is not driven by measurements:
 * doors and windows are counted, gallons are derived, and fees are flat.
 *
 * Kept in sync with the backfill in migrations/0003_rooms.sql.
 */
export const SURFACE_BY_NAME: Record<string, Surface> = {
  'Interior walls': 'wall',
  'Exterior siding': 'wall',
  Priming: 'wall',
  'Wallpaper removal': 'wall',
  'Pressure washing': 'wall',
  Ceilings: 'ceiling',
  'Popcorn ceiling removal': 'ceiling',
  'Trim and baseboard': 'trim',
  'Crown molding': 'trim',
  Caulking: 'trim',
  'Exterior soffit and fascia': 'trim',
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
const SEED_ITEMS: SeedItem[] = [
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

export const SEED_PRICE_BOOK: SeedItem[] = SEED_ITEMS.map((item) => ({
  ...item,
  surface: SURFACE_BY_NAME[item.name] ?? null,
}))
