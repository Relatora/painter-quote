/** Shared between the Worker and the client. No runtime dependencies. */

export type Category = 'labor' | 'material' | 'prep' | 'fee'
export type UnitType = 'sqft' | 'linft' | 'unit' | 'hour' | 'gallon' | 'flat'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined'

export const CATEGORIES: Category[] = ['labor', 'material', 'prep', 'fee']
export const UNIT_TYPES: UnitType[] = ['sqft', 'linft', 'unit', 'hour', 'gallon', 'flat']

/** Short suffix shown next to a quantity, e.g. "340 sq ft". `flat` shows nothing. */
export const UNIT_LABEL: Record<UnitType, string> = {
  sqft: 'sq ft',
  linft: 'lin ft',
  unit: 'ea',
  hour: 'hr',
  gallon: 'gal',
  flat: '',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  labor: 'Labor',
  material: 'Materials',
  prep: 'Prep',
  fee: 'Fees',
}

/** Order sections appear in on the quote document. */
export const CATEGORY_ORDER: Category[] = ['prep', 'labor', 'material', 'fee']

export interface Contractor {
  id: string
  companyName: string
  ownerName: string | null
  email: string | null
  phone: string | null
  address: string | null
  logoKey: string | null
  taxRateBps: number
  jobMinimumCents: number
  quoteTerms: string | null
  quoteValidityDays: number
  nextQuoteNumber: number
  createdAt: string
}

export interface PriceBookItem {
  id: string
  contractorId: string
  name: string
  description: string | null
  category: Category
  unitType: UnitType
  unitPriceCents: number
  isDefault: boolean
  sortOrder: number
  archived: boolean
  createdAt: string
}

export interface QuoteLineItem {
  id: string
  quoteId: string
  priceBookItemId: string | null
  name: string
  description: string | null
  category: Category
  unitType: UnitType
  quantity: number
  unitPriceCents: number
  isPriceUnconfirmed: boolean
  sortOrder: number
}

export interface Quote {
  id: string
  contractorId: string
  quoteNumber: string
  title: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  jobAddress: string | null
  status: QuoteStatus
  notes: string | null
  terms: string | null
  taxRateBps: number
  jobMinimumCents: number
  publicToken: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

export interface QuotePhoto {
  id: string
  quoteId: string
  contentType: string
  width: number | null
  height: number | null
  byteSize: number | null
  sortOrder: number
  createdAt: string
}

export interface QuoteWithItems extends Quote {
  lineItems: QuoteLineItem[]
  photos: QuotePhoto[]
}

/** Longest edge, in pixels, that a photo is resized to before upload. */
export const PHOTO_MAX_EDGE = 1024

/** Upload ceiling after resize. A 1024px JPEG lands far below this in practice. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024

/** A quote as it appears in the list screen: no line items, but a computed total. */
export interface QuoteSummary extends Quote {
  totalCents: number
  itemCount: number
}

/** What the public customer-facing view receives. Deliberately excludes ids and tokens. */
export interface PublicQuote {
  quoteNumber: string
  title: string
  customerName: string | null
  jobAddress: string | null
  status: QuoteStatus
  notes: string | null
  terms: string | null
  createdAt: string
  expiresAt: string | null
  photoIds: string[]
  company: {
    name: string
    ownerName: string | null
    email: string | null
    phone: string | null
    address: string | null
  }
  lineItems: Array<{
    name: string
    description: string | null
    category: Category
    unitType: UnitType
    quantity: number
    unitPriceCents: number
    lineTotalCents: number
  }>
  totals: QuoteTotals
}

export interface QuoteTotals {
  subtotalCents: number
  /** Amount added to reach the contractor's job minimum. 0 when not applied. */
  minimumAdjustmentCents: number
  taxableCents: number
  taxCents: number
  totalCents: number
  /** True when any line still carries an unconfirmed seed price. Blocks finalizing. */
  hasUnconfirmedPrices: boolean
}

/** The mandatory default. A quote is an estimate, not a fixed-price contract. */
export const DEFAULT_TERMS =
  'This is an estimate, subject to on-site verification. Final pricing may change if ' +
  'conditions differ from those described or shown in the photos provided. Valid for ' +
  '30 days from the date above.'

/* ---------------------------------------------------------------------------
   AI scope analysis
   --------------------------------------------------------------------------- */

export type Confidence = 'high' | 'medium' | 'low'

/**
 * One thing the model believes the job involves.
 *
 * Deliberately carries no quantity and no price. The model identifies WHAT the work is;
 * the contractor supplies dimensions and the price book supplies the rate. A vision model
 * cannot measure area from an uncalibrated phone photo, and area is what sets the price.
 */
export interface ScopeItem {
  /** Plain language, in the painter's own vocabulary. */
  label: string
  /** Exact name of a price book item, chosen from the list supplied in the prompt. */
  priceBookName: string | null
  confidence: Confidence
  /** What in the photo or description led here. Shown so the painter can judge it. */
  reason: string
}

export interface ScopeAnalysis {
  /** Surfaces to be coated. */
  surfaces: ScopeItem[]
  /** Prep and conditions: the line items painters most often forget to charge for. */
  conditions: ScopeItem[]
  /** What could not be determined from what was provided. Never invented certainty. */
  uncertainties: string[]
  /** True when the response came from the offline stub rather than a real model. */
  demo: boolean
}
