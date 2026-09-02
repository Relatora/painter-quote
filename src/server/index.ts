import { Hono } from 'hono'
import type { PublicQuote, QuoteWithItems, Contractor } from '../shared/types'
import { calculateTotals, lineTotalCents } from '../shared/pricing'
import {
  getOrCreateContractor,
  updateContractor,
  listPriceBook,
  confirmPriceBookPrice,
  listQuotes,
  createQuote,
  getQuote,
  updateQuote,
  deleteQuote,
  replaceLineItems,
  getQuoteByToken,
  type ContractorPatch,
  type QuotePatch,
  type LineItemInput,
} from './repo'

export type Bindings = {
  DB: D1Database
  PHOTOS: R2Bucket
  DEMO_MODE: string
  AI_TIER: string
  ALLOW_TIER_OVERRIDE: string
  GEMINI_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) =>
  c.json({ ok: true, demoMode: c.env.DEMO_MODE === '1', aiTier: c.env.AI_TIER }),
)

// ---------------------------------------------------------------------------
// Contractor settings
// ---------------------------------------------------------------------------

app.get('/api/contractor', async (c) => c.json(await getOrCreateContractor(c.env.DB)))

app.patch('/api/contractor', async (c) => {
  const patch = (await c.req.json()) as ContractorPatch
  return c.json(await updateContractor(c.env.DB, patch))
})

// ---------------------------------------------------------------------------
// Price book
// ---------------------------------------------------------------------------

app.get('/api/pricebook', async (c) => {
  await getOrCreateContractor(c.env.DB) // seeds on first run
  return c.json(await listPriceBook(c.env.DB))
})

app.patch('/api/pricebook/:id', async (c) => {
  const { unitPriceCents } = (await c.req.json()) as { unitPriceCents: number }
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    return c.json({ error: 'unitPriceCents must be a non-negative integer' }, 400)
  }
  await confirmPriceBookPrice(c.env.DB, c.req.param('id'), unitPriceCents)
  return c.json(await listPriceBook(c.env.DB))
})

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

app.get('/api/quotes', async (c) => {
  await getOrCreateContractor(c.env.DB)
  return c.json(await listQuotes(c.env.DB))
})

app.post('/api/quotes', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string }
  const title = body.title?.trim() || 'Untitled job'
  return c.json(await createQuote(c.env.DB, title), 201)
})

app.get('/api/quotes/:id', async (c) => {
  const quote = await getQuote(c.env.DB, c.req.param('id'))
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

app.patch('/api/quotes/:id', async (c) => {
  const patch = (await c.req.json()) as QuotePatch
  const quote = await updateQuote(c.env.DB, c.req.param('id'), patch)
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

app.delete('/api/quotes/:id', async (c) => {
  await deleteQuote(c.env.DB, c.req.param('id'))
  return c.json({ ok: true })
})

app.put('/api/quotes/:id/items', async (c) => {
  const body = (await c.req.json()) as { items: LineItemInput[] }
  if (!Array.isArray(body.items)) return c.json({ error: 'items must be an array' }, 400)

  const clean = body.items.map((item) => ({
    priceBookItemId: item.priceBookItemId ?? null,
    name: String(item.name ?? '').slice(0, 200) || 'Untitled item',
    description: item.description ? String(item.description).slice(0, 1000) : null,
    category: item.category,
    unitType: item.unitType,
    quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
    unitPriceCents: Number.isInteger(item.unitPriceCents) ? item.unitPriceCents : 0,
    isPriceUnconfirmed: Boolean(item.isPriceUnconfirmed),
  }))

  const quote = await replaceLineItems(c.env.DB, c.req.param('id'), clean)
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

// ---------------------------------------------------------------------------
// Public customer-facing quote. No auth: the token is the credential.
// ---------------------------------------------------------------------------

function toPublicQuote(quote: QuoteWithItems, contractor: Contractor): PublicQuote {
  return {
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    customerName: quote.customerName,
    jobAddress: quote.jobAddress,
    status: quote.status,
    notes: quote.notes,
    terms: quote.terms,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
    company: {
      name: contractor.companyName,
      ownerName: contractor.ownerName,
      email: contractor.email,
      phone: contractor.phone,
      address: contractor.address,
    },
    lineItems: quote.lineItems.map((item) => ({
      name: item.name,
      description: item.description,
      category: item.category,
      unitType: item.unitType,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: lineTotalCents(item),
    })),
    totals: calculateTotals({
      lineItems: quote.lineItems,
      taxRateBps: quote.taxRateBps,
      jobMinimumCents: quote.jobMinimumCents,
    }),
  }
}

app.get('/api/public/:token', async (c) => {
  const found = await getQuoteByToken(c.env.DB, c.req.param('token'))
  if (!found) return c.json({ error: 'Not found' }, 404)
  return c.json(toPublicQuote(found.quote, found.contractor))
})

// Any unmatched /api/* path is a 404 rather than falling through to the SPA shell,
// which would otherwise return HTML to a fetch expecting JSON.
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

export default app
