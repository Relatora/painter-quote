import type {
  Contractor,
  PriceBookItem,
  Quote,
  QuoteLineItem,
  QuoteWithItems,
  QuoteSummary,
  QuotePhoto,
  QuoteRoom,
  Surface,
  Category,
  UnitType,
  QuoteStatus,
} from '../../shared/types'
import { DEFAULT_TERMS } from '../../shared/types'
import { calculateTotals } from '../../shared/pricing'
import { SEED_PRICE_BOOK } from '../fixtures/seed-price-book'

/**
 * Until magic-link auth lands, every request belongs to one local contractor. Keeping the
 * id in one place means adding real auth is a matter of resolving this from a session
 * rather than threading a new parameter through every call site.
 */
export const DEMO_CONTRACTOR_ID = 'demo-contractor'

export const newId = () => crypto.randomUUID()

/** URL-safe, unguessable token for the public quote view. 128 bits of entropy. */
export function newPublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const nowIso = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Row mapping. D1 returns snake_case columns and 0/1 for booleans.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function toContractor(r: any): Contractor {
  return {
    id: r.id,
    companyName: r.company_name,
    ownerName: r.owner_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    logoKey: r.logo_key,
    taxRateBps: r.tax_rate_bps,
    jobMinimumCents: r.job_minimum_cents,
    quoteTerms: r.quote_terms,
    quoteValidityDays: r.quote_validity_days,
    nextQuoteNumber: r.next_quote_number,
    createdAt: r.created_at,
  }
}

function toPriceBookItem(r: any): PriceBookItem {
  return {
    id: r.id,
    contractorId: r.contractor_id,
    name: r.name,
    description: r.description,
    category: r.category as Category,
    unitType: r.unit_type as UnitType,
    unitPriceCents: r.unit_price_cents,
    isDefault: r.is_default === 1,
    surface: (r.surface as Surface | null) ?? null,
    sortOrder: r.sort_order,
    archived: r.archived === 1,
    createdAt: r.created_at,
  }
}

function toQuote(r: any): Quote {
  return {
    id: r.id,
    contractorId: r.contractor_id,
    quoteNumber: r.quote_number,
    title: r.title,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    jobAddress: r.job_address,
    status: r.status as QuoteStatus,
    notes: r.notes,
    terms: r.terms,
    taxRateBps: r.tax_rate_bps,
    jobMinimumCents: r.job_minimum_cents,
    publicToken: r.public_token,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  }
}

function toLineItem(r: any): QuoteLineItem {
  return {
    id: r.id,
    quoteId: r.quote_id,
    priceBookItemId: r.price_book_item_id,
    name: r.name,
    description: r.description,
    category: r.category as Category,
    unitType: r.unit_type as UnitType,
    quantity: r.quantity,
    unitPriceCents: r.unit_price_cents,
    isPriceUnconfirmed: r.is_price_unconfirmed === 1,
    sortOrder: r.sort_order,
  }
}

function toPhoto(r: any): QuotePhoto {
  return {
    id: r.id,
    quoteId: r.quote_id,
    contentType: r.content_type,
    width: r.width,
    height: r.height,
    byteSize: r.byte_size,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

function toRoom(r: any): QuoteRoom {
  return {
    id: r.id,
    quoteId: r.quote_id,
    name: r.name,
    wallSqft: r.wall_sqft,
    ceilingSqft: r.ceiling_sqft,
    trimLinft: r.trim_linft,
    coats: r.coats,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Contractor
// ---------------------------------------------------------------------------

/**
 * Returns the local contractor, creating it and seeding the price book on first call.
 * Idempotent, so it is safe to call at the top of every request.
 */
export async function getOrCreateContractor(db: D1Database): Promise<Contractor> {
  const existing = await db
    .prepare('SELECT * FROM contractor WHERE id = ?')
    .bind(DEMO_CONTRACTOR_ID)
    .first()

  if (existing) return toContractor(existing)

  const created = nowIso()
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO contractor
           (id, company_name, owner_name, email, phone, address, logo_key,
            tax_rate_bps, job_minimum_cents, quote_terms, quote_validity_days,
            next_quote_number, created_at)
         VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, 0, 0, ?, 30, 1, ?)`,
      )
      .bind(DEMO_CONTRACTOR_ID, 'Your Company', DEFAULT_TERMS, created),
  ]

  SEED_PRICE_BOOK.forEach((item, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO price_book_item
             (id, contractor_id, name, description, category, unit_type,
              unit_price_cents, is_default, surface, sort_order, archived, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?)`,
        )
        .bind(
          newId(),
          DEMO_CONTRACTOR_ID,
          item.name,
          item.description,
          item.category,
          item.unitType,
          item.unitPriceCents,
          item.surface ?? null,
          index,
          created,
        ),
    )
  })

  await db.batch(statements)

  const row = await db
    .prepare('SELECT * FROM contractor WHERE id = ?')
    .bind(DEMO_CONTRACTOR_ID)
    .first()
  return toContractor(row)
}

export type ContractorPatch = Partial<
  Pick<
    Contractor,
    | 'companyName'
    | 'ownerName'
    | 'email'
    | 'phone'
    | 'address'
    | 'taxRateBps'
    | 'jobMinimumCents'
    | 'quoteTerms'
    | 'quoteValidityDays'
  >
>

const CONTRACTOR_COLUMNS: Record<keyof ContractorPatch, string> = {
  companyName: 'company_name',
  ownerName: 'owner_name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  taxRateBps: 'tax_rate_bps',
  jobMinimumCents: 'job_minimum_cents',
  quoteTerms: 'quote_terms',
  quoteValidityDays: 'quote_validity_days',
}

export async function updateContractor(
  db: D1Database,
  patch: ContractorPatch,
): Promise<Contractor> {
  const entries = Object.entries(patch).filter(([key]) => key in CONTRACTOR_COLUMNS)
  if (entries.length > 0) {
    const setSql = entries
      .map(([key]) => `${CONTRACTOR_COLUMNS[key as keyof ContractorPatch]} = ?`)
      .join(', ')
    await db
      .prepare(`UPDATE contractor SET ${setSql} WHERE id = ?`)
      .bind(...entries.map(([, value]) => value), DEMO_CONTRACTOR_ID)
      .run()
  }
  return getOrCreateContractor(db)
}

// ---------------------------------------------------------------------------
// Price book
// ---------------------------------------------------------------------------

export async function listPriceBook(db: D1Database): Promise<PriceBookItem[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM price_book_item
        WHERE contractor_id = ? AND archived = 0
        ORDER BY sort_order, name`,
    )
    .bind(DEMO_CONTRACTOR_ID)
    .all()
  return results.map(toPriceBookItem)
}

/**
 * Confirms a price the contractor edited, clearing the unconfirmed-default flag.
 * This is how the price book fills itself in: every correction is a permanent answer.
 */
export async function confirmPriceBookPrice(
  db: D1Database,
  id: string,
  unitPriceCents: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE price_book_item
          SET unit_price_cents = ?, is_default = 0
        WHERE id = ? AND contractor_id = ?`,
    )
    .bind(unitPriceCents, id, DEMO_CONTRACTOR_ID)
    .run()
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/**
 * Quotes for the list screen, each with its computed total.
 *
 * Totals are calculated in TypeScript by the same engine the quote document uses, not
 * summed in SQL. Reproducing the job-minimum and tax rules in a query would create a
 * second, silently divergent definition of what a quote costs.
 */
export async function listQuotes(db: D1Database): Promise<QuoteSummary[]> {
  const { results } = await db
    .prepare('SELECT * FROM quote WHERE contractor_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(DEMO_CONTRACTOR_ID)
    .all()

  const quotes = results.map(toQuote)
  if (quotes.length === 0) return []

  // One query for every line item across the page of quotes, then group in memory.
  const placeholders = quotes.map(() => '?').join(', ')
  const { results: itemRows } = await db
    .prepare(`SELECT * FROM quote_line_item WHERE quote_id IN (${placeholders})`)
    .bind(...quotes.map((q) => q.id))
    .all()

  const byQuote = new Map<string, QuoteLineItem[]>()
  for (const row of itemRows) {
    const item = toLineItem(row)
    const list = byQuote.get(item.quoteId)
    if (list) list.push(item)
    else byQuote.set(item.quoteId, [item])
  }

  return quotes.map((quote) => {
    const totals = calculateTotals({
      lineItems: byQuote.get(quote.id) ?? [],
      taxRateBps: quote.taxRateBps,
      jobMinimumCents: quote.jobMinimumCents,
    })
    return { ...quote, totalCents: totals.totalCents, itemCount: (byQuote.get(quote.id) ?? []).length }
  })
}

export async function createQuote(db: D1Database, title: string): Promise<QuoteWithItems> {
  const contractor = await getOrCreateContractor(db)
  const id = newId()
  const created = nowIso()
  const quoteNumber = `Q-${String(contractor.nextQuoteNumber).padStart(4, '0')}`

  const expiresAt = new Date(
    Date.now() + contractor.quoteValidityDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  await db.batch([
    db
      .prepare(
        `INSERT INTO quote
           (id, contractor_id, quote_number, title, customer_name, customer_email,
            customer_phone, job_address, status, notes, terms, tax_rate_bps,
            job_minimum_cents, public_token, created_at, updated_at, expires_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, 'draft', NULL, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        DEMO_CONTRACTOR_ID,
        quoteNumber,
        title,
        // Terms and rates are snapshotted so a sent quote never changes retroactively
        // because the contractor later edited a setting.
        contractor.quoteTerms ?? DEFAULT_TERMS,
        contractor.taxRateBps,
        contractor.jobMinimumCents,
        newPublicToken(),
        created,
        created,
        expiresAt,
      ),
    db
      .prepare('UPDATE contractor SET next_quote_number = next_quote_number + 1 WHERE id = ?')
      .bind(DEMO_CONTRACTOR_ID),
  ])

  const quote = await getQuote(db, id)
  if (!quote) throw new Error('Quote vanished immediately after insert')
  return quote
}

export async function getQuote(db: D1Database, id: string): Promise<QuoteWithItems | null> {
  const row = await db
    .prepare('SELECT * FROM quote WHERE id = ? AND contractor_id = ?')
    .bind(id, DEMO_CONTRACTOR_ID)
    .first()
  if (!row) return null

  const [items, photos, rooms] = await Promise.all([
    db
      .prepare('SELECT * FROM quote_line_item WHERE quote_id = ? ORDER BY sort_order')
      .bind(id)
      .all(),
    db
      .prepare('SELECT * FROM quote_photo WHERE quote_id = ? ORDER BY sort_order')
      .bind(id)
      .all(),
    db.prepare('SELECT * FROM quote_room WHERE quote_id = ? ORDER BY sort_order').bind(id).all(),
  ])

  return {
    ...toQuote(row),
    lineItems: items.results.map(toLineItem),
    photos: photos.results.map(toPhoto),
    rooms: rooms.results.map(toRoom),
  }
}

/** Public lookup by token. Deliberately does NOT filter on contractor id. */
export async function getQuoteByToken(
  db: D1Database,
  token: string,
): Promise<{ quote: QuoteWithItems; contractor: Contractor } | null> {
  const row = await db.prepare('SELECT * FROM quote WHERE public_token = ?').bind(token).first()
  if (!row) return null

  const quote = toQuote(row)
  const [items, photos] = await Promise.all([
    db
      .prepare('SELECT * FROM quote_line_item WHERE quote_id = ? ORDER BY sort_order')
      .bind(quote.id)
      .all(),
    db
      .prepare('SELECT * FROM quote_photo WHERE quote_id = ? ORDER BY sort_order')
      .bind(quote.id)
      .all(),
  ])

  const contractorRow = await db
    .prepare('SELECT * FROM contractor WHERE id = ?')
    .bind(quote.contractorId)
    .first()
  if (!contractorRow) return null

  return {
    quote: {
      ...quote,
      lineItems: items.results.map(toLineItem),
      photos: photos.results.map(toPhoto),
      // Rooms are the painter's working measurements, not part of what a customer sees.
      rooms: [],
    },
    contractor: toContractor(contractorRow),
  }
}

export type QuotePatch = Partial<
  Pick<
    Quote,
    | 'title'
    | 'customerName'
    | 'customerEmail'
    | 'customerPhone'
    | 'jobAddress'
    | 'status'
    | 'notes'
    | 'terms'
    | 'taxRateBps'
    | 'jobMinimumCents'
  >
>

const QUOTE_COLUMNS: Record<keyof QuotePatch, string> = {
  title: 'title',
  customerName: 'customer_name',
  customerEmail: 'customer_email',
  customerPhone: 'customer_phone',
  jobAddress: 'job_address',
  status: 'status',
  notes: 'notes',
  terms: 'terms',
  taxRateBps: 'tax_rate_bps',
  jobMinimumCents: 'job_minimum_cents',
}

export async function updateQuote(
  db: D1Database,
  id: string,
  patch: QuotePatch,
): Promise<QuoteWithItems | null> {
  const entries = Object.entries(patch).filter(([key]) => key in QUOTE_COLUMNS)
  const setSql = entries
    .map(([key]) => `${QUOTE_COLUMNS[key as keyof QuotePatch]} = ?`)
    .concat('updated_at = ?')
    .join(', ')

  await db
    .prepare(`UPDATE quote SET ${setSql} WHERE id = ? AND contractor_id = ?`)
    .bind(...entries.map(([, value]) => value), nowIso(), id, DEMO_CONTRACTOR_ID)
    .run()

  return getQuote(db, id)
}

export async function deleteQuote(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM quote_line_item WHERE quote_id = ?').bind(id),
    db.prepare('DELETE FROM quote WHERE id = ? AND contractor_id = ?').bind(id, DEMO_CONTRACTOR_ID),
  ])
}

export interface LineItemInput {
  priceBookItemId: string | null
  name: string
  description: string | null
  category: Category
  unitType: UnitType
  quantity: number
  unitPriceCents: number
  isPriceUnconfirmed: boolean
}

/**
 * Replaces a quote's line items wholesale.
 *
 * The editor holds the whole list in local state and saves it as one unit, so a
 * delete-then-insert inside a single batch is both simpler and safer than diffing:
 * there is no window where the quote is partially updated.
 */
export async function replaceLineItems(
  db: D1Database,
  quoteId: string,
  items: LineItemInput[],
): Promise<QuoteWithItems | null> {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM quote_line_item WHERE quote_id = ?').bind(quoteId),
  ]

  items.forEach((item, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO quote_line_item
             (id, quote_id, price_book_item_id, name, description, category,
              unit_type, quantity, unit_price_cents, is_price_unconfirmed, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          quoteId,
          item.priceBookItemId,
          item.name,
          item.description,
          item.category,
          item.unitType,
          item.quantity,
          item.unitPriceCents,
          item.isPriceUnconfirmed ? 1 : 0,
          index,
        ),
    )
  })

  statements.push(
    db.prepare('UPDATE quote SET updated_at = ? WHERE id = ?').bind(nowIso(), quoteId),
  )

  await db.batch(statements)
  return getQuote(db, quoteId)
}

// ---------------------------------------------------------------------------
// Photos. Bytes live in R2; only keys and metadata live here.
// ---------------------------------------------------------------------------

export interface PhotoInput {
  r2Key: string
  contentType: string
  width: number | null
  height: number | null
  byteSize: number | null
}

export async function createPhoto(
  db: D1Database,
  quoteId: string,
  input: PhotoInput,
): Promise<QuotePhoto> {
  const id = newId()
  const created = nowIso()

  const next = await db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM quote_photo WHERE quote_id = ?')
    .bind(quoteId)
    .first<{ next: number }>()

  await db
    .prepare(
      `INSERT INTO quote_photo
         (id, quote_id, r2_key, content_type, width, height, byte_size, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      quoteId,
      input.r2Key,
      input.contentType,
      input.width,
      input.height,
      input.byteSize,
      next?.next ?? 0,
      created,
    )
    .run()

  const row = await db.prepare('SELECT * FROM quote_photo WHERE id = ?').bind(id).first()
  return toPhoto(row)
}

/** Returns the row including its R2 key, which the public shape deliberately omits. */
export async function getPhotoRow(
  db: D1Database,
  id: string,
): Promise<(QuotePhoto & { r2Key: string }) | null> {
  const row = await db.prepare('SELECT * FROM quote_photo WHERE id = ?').bind(id).first()
  if (!row) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...toPhoto(row), r2Key: (row as any).r2_key }
}

export async function deletePhoto(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM quote_photo WHERE id = ?').bind(id).run()
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export interface RoomInput {
  name: string
  wallSqft: number
  ceilingSqft: number
  trimLinft: number
  coats: number
}

/**
 * Replaces a quote's rooms wholesale, matching how line items are saved. The sheet holds
 * the whole list locally and commits it as one unit, so there is no window in which a
 * quote carries half the measurements.
 */
export async function replaceRooms(
  db: D1Database,
  quoteId: string,
  rooms: RoomInput[],
): Promise<QuoteRoom[]> {
  const created = nowIso()
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM quote_room WHERE quote_id = ?').bind(quoteId),
  ]

  rooms.forEach((room, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO quote_room
             (id, quote_id, name, wall_sqft, ceiling_sqft, trim_linft, coats, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          quoteId,
          room.name,
          room.wallSqft,
          room.ceilingSqft,
          room.trimLinft,
          room.coats,
          index,
          created,
        ),
    )
  })

  await db.batch(statements)

  const { results } = await db
    .prepare('SELECT * FROM quote_room WHERE quote_id = ? ORDER BY sort_order')
    .bind(quoteId)
    .all()
  return results.map(toRoom)
}
