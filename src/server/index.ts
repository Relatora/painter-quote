import { Hono } from 'hono'
import type { PublicQuote, QuoteWithItems, Contractor } from '../shared/types'
import { PHOTO_MAX_BYTES } from '../shared/types'
import { getVisionProvider, VisionError } from './ai'
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
  createPhoto,
  getPhotoRow,
  deletePhoto,
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
  GEMINI_MODEL?: string
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
// Photos
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Raw bytes in the request body rather than multipart. The client has already decoded,
 * re-oriented, resized, and re-encoded the image to JPEG, so there is nothing left for a
 * multipart envelope to carry and parsing one on the Worker would only cost CPU.
 */
app.post('/api/quotes/:id/photos', async (c) => {
  const quoteId = c.req.param('id')
  const quote = await getQuote(c.env.DB, quoteId)
  if (!quote) return c.json({ error: 'Not found' }, 404)

  const contentType = c.req.header('content-type') ?? ''
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return c.json({ error: 'Unsupported image type' }, 415)
  }

  const bytes = await c.req.arrayBuffer()
  if (bytes.byteLength === 0) return c.json({ error: 'Empty upload' }, 400)
  if (bytes.byteLength > PHOTO_MAX_BYTES) return c.json({ error: 'Image too large' }, 413)

  const width = Number.parseInt(c.req.query('w') ?? '', 10)
  const height = Number.parseInt(c.req.query('h') ?? '', 10)

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const r2Key = `quotes/${quoteId}/${crypto.randomUUID()}.${extension}`

  await c.env.PHOTOS.put(r2Key, bytes, { httpMetadata: { contentType } })

  const photo = await createPhoto(c.env.DB, quoteId, {
    r2Key,
    contentType,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    byteSize: bytes.byteLength,
  })

  return c.json(photo, 201)
})

/**
 * Streams the object out of R2. Unauthenticated, like the public quote itself: the
 * random photo id is the credential, and a customer opening a quote link has to be able
 * to load the images without an account.
 */
app.get('/api/photos/:id', async (c) => {
  const row = await getPhotoRow(c.env.DB, c.req.param('id'))
  if (!row) return c.json({ error: 'Not found' }, 404)

  const object = await c.env.PHOTOS.get(row.r2Key)
  if (!object) return c.json({ error: 'Not found' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': row.contentType,
      // Content at this key never changes: a new upload gets a new key and a new id.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.httpEtag,
    },
  })
})

app.delete('/api/photos/:id', async (c) => {
  const row = await getPhotoRow(c.env.DB, c.req.param('id'))
  if (!row) return c.json({ error: 'Not found' }, 404)
  // Remove the row first. An orphaned R2 object costs pennies; a row pointing at a
  // deleted object renders a broken image on a customer's quote.
  await deletePhoto(c.env.DB, row.id)
  await c.env.PHOTOS.delete(row.r2Key).catch(() => undefined)
  return c.json({ ok: true })
})


// ---------------------------------------------------------------------------
// AI scope analysis
// ---------------------------------------------------------------------------

/** Cap on images sent to the model. Beyond this, cost climbs with little added signal. */
const MAX_PHOTOS_ANALYSED = 6

app.post('/api/quotes/:id/analyze', async (c) => {
  const quoteId = c.req.param('id')
  const quote = await getQuote(c.env.DB, quoteId)
  if (!quote) return c.json({ error: 'Not found' }, 404)

  if (quote.photos.length === 0 && !quote.title.trim() && !quote.notes?.trim()) {
    return c.json({ error: 'Add a photo or describe the job first.' }, 400)
  }

  const photoRows = quote.photos.slice(0, MAX_PHOTOS_ANALYSED)
  const fetched = await Promise.all(
    photoRows.map(async (photo) => {
      const row = await getPhotoRow(c.env.DB, photo.id)
      if (!row) return null
      const object = await c.env.PHOTOS.get(row.r2Key)
      if (!object) return null
      return { bytes: await object.arrayBuffer(), contentType: row.contentType }
    }),
  )

  const priceBook = await listPriceBook(c.env.DB)

  // The description the painter gave is the title plus any notes. Both are optional,
  // and the prompt handles an empty description rather than failing.
  const description = [quote.title, quote.notes].filter(Boolean).join('. ')

  try {
    const provider = getVisionProvider(c.env)
    const analysis = await provider.analyzeJob({
      description,
      photos: fetched.filter((p): p is NonNullable<typeof p> => p !== null),
      priceBookNames: priceBook.map((item) => item.name),
    })
    return c.json(analysis)
  } catch (e) {
    if (e instanceof VisionError) {
      console.error('vision failure', e.status, e.detail)
      // Upstream 4xx are our configuration or quota problem, not the caller's request,
      // so they surface as 502 with a message the contractor can act on.
      return c.json({ error: e.message }, 502)
    }
    console.error('vision failure', e)
    return c.json({ error: 'The AI could not read this job.' }, 502)
  }
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
    photoIds: quote.photos.map((p) => p.id),
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
