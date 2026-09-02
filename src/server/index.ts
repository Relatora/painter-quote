import { Hono, type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { PublicQuote, QuoteWithItems, Contractor } from '../shared/types'
import { PHOTO_MAX_BYTES } from '../shared/types'
import { calculateTotals, lineTotalCents } from '../shared/pricing'
import { getVisionProvider, VisionError } from './ai'
import { getEmailSender } from './auth/email'
import {
  SESSION_COOKIE,
  createSession,
  readSession,
  sessionCookie,
  clearedCookie,
  createLoginToken,
  hashLoginToken,
  normalizeEmail,
  looksLikeEmail,
} from './auth/session'
import {
  DEMO_CONTRACTOR_ID,
  ensureDemoContractor,
  findContractorById,
  findContractorByEmail,
  createContractor,
  updateContractor,
  listPriceBook,
  confirmPriceBookPrice,
  listQuotes,
  createQuote,
  getQuote,
  updateQuote,
  deleteQuote,
  replaceLineItems,
  replaceRooms,
  getQuoteByToken,
  createPhoto,
  getPhotoRow,
  deletePhoto,
  newId,
  type ContractorPatch,
  type QuotePatch,
  type LineItemInput,
  type RoomInput,
} from './repo'

export type Bindings = {
  DB: D1Database
  PHOTOS: R2Bucket
  DEMO_MODE: string
  AI_TIER: string
  ALLOW_TIER_OVERRIDE: string
  SESSION_SECRET?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

type Ctx = Context<{ Bindings: Bindings }>

const app = new Hono<{ Bindings: Bindings }>()

/** A magic link is short lived. Long enough to switch to a mail app, not much longer. */
const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000

/**
 * Development fallback only. A deployment MUST set SESSION_SECRET as a Wrangler secret:
 * with a known signing key anybody could forge a session for any contractor.
 */
const DEV_SECRET = 'painter-quote-development-only-secret'

const sessionSecret = (env: Bindings) => env.SESSION_SECRET || DEV_SECRET
const isHttps = (url: string) => new URL(url).protocol === 'https:'

const unauthorized = { error: 'Sign in to continue.' } as const

/**
 * Resolves the contractor for this request.
 *
 * A valid session cookie wins. Failing that, and only while DEMO_MODE is on, the request
 * falls back to the shared demo contractor, which keeps the hand-a-painter-a-phone
 * validation path working with no account in the way. With DEMO_MODE off there is no
 * fallback and unauthenticated requests are refused.
 */
async function requireContractor(c: Ctx): Promise<string | null> {
  const cookie = getCookie(c, SESSION_COOKIE)
  if (cookie) {
    const id = await readSession(cookie, sessionSecret(c.env))
    if (id) return id
  }
  if (c.env.DEMO_MODE === '1') {
    await ensureDemoContractor(c.env.DB)
    return DEMO_CONTRACTOR_ID
  }
  return null
}

app.get('/api/health', (c) =>
  c.json({ ok: true, demoMode: c.env.DEMO_MODE === '1', aiTier: c.env.AI_TIER }),
)

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

app.get('/api/auth/me', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json({ signedIn: false })

  const contractor = await findContractorById(c.env.DB, contractorId)
  if (!contractor) return c.json({ signedIn: false })

  return c.json({ signedIn: true, demo: contractorId === DEMO_CONTRACTOR_ID, contractor })
})

app.post('/api/auth/request', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string }
  const email = normalizeEmail(String(body.email ?? ''))
  if (!looksLikeEmail(email)) return c.json({ error: 'Enter a valid email address.' }, 400)

  const token = createLoginToken()

  await c.env.DB.prepare(
    'INSERT INTO login_token (token_hash, email, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
  )
    .bind(
      await hashLoginToken(token),
      email,
      new Date(Date.now() + LOGIN_TOKEN_TTL_MS).toISOString(),
      new Date().toISOString(),
    )
    .run()

  const link = `${new URL(c.req.url).origin}/auth/callback?token=${token}`
  const sender = getEmailSender(c.env)

  try {
    await sender.sendMagicLink(email, link)
  } catch (e) {
    console.error('magic link send failed', e)
    return c.json({ error: 'Could not send the sign-in email. Try again shortly.' }, 502)
  }

  return c.json({
    // The response never reveals whether the address already has an account, so this
    // endpoint cannot be used to find out which painters have signed up.
    sent: true,
    // Development affordance so sign-in works with no email provider configured. Gated on
    // DEMO_MODE specifically, because returning a working login link to an unauthenticated
    // caller in production would hand an account to anyone who knows an address.
    devLink: c.env.DEMO_MODE === '1' && sender.isStub ? link : undefined,
  })
})

app.get('/auth/callback', async (c) => {
  const tokenHash = await hashLoginToken(c.req.query('token') ?? '')
  const now = new Date().toISOString()

  const row = await c.env.DB.prepare(
    'SELECT email, expires_at, used_at FROM login_token WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .first<{ email: string; expires_at: string; used_at: string | null }>()

  // One outcome for every failure mode. Distinguishing expired from already used from
  // never existed would tell an attacker which guesses were getting close.
  if (!row || row.used_at || row.expires_at < now) {
    return c.redirect('/signin?error=link', 302)
  }

  // Burn the token before issuing the session, so a double-tapped link cannot mint two.
  await c.env.DB.prepare(
    'UPDATE login_token SET used_at = ? WHERE token_hash = ? AND used_at IS NULL',
  )
    .bind(now, tokenHash)
    .run()

  const existing = await findContractorByEmail(c.env.DB, row.email)
  const contractor = existing ?? (await createContractor(c.env.DB, newId(), row.email))

  const session = await createSession(contractor.id, sessionSecret(c.env))
  c.header('Set-Cookie', sessionCookie(session, isHttps(c.req.url)))
  return c.redirect('/', 302)
})

app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', clearedCookie(isHttps(c.req.url)))
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Contractor settings
// ---------------------------------------------------------------------------

app.get('/api/contractor', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  const contractor = await findContractorById(c.env.DB, contractorId)
  return contractor ? c.json(contractor) : c.json(unauthorized, 401)
})

app.patch('/api/contractor', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  const patch = (await c.req.json()) as ContractorPatch
  return c.json(await updateContractor(c.env.DB, contractorId, patch))
})

// ---------------------------------------------------------------------------
// Price book
// ---------------------------------------------------------------------------

app.get('/api/pricebook', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  return c.json(await listPriceBook(c.env.DB, contractorId))
})

app.patch('/api/pricebook/:id', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const { unitPriceCents } = (await c.req.json()) as { unitPriceCents: number }
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    return c.json({ error: 'unitPriceCents must be a non-negative integer' }, 400)
  }
  await confirmPriceBookPrice(c.env.DB, contractorId, c.req.param('id'), unitPriceCents)
  return c.json(await listPriceBook(c.env.DB, contractorId))
})

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

app.get('/api/quotes', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  return c.json(await listQuotes(c.env.DB, contractorId))
})

app.post('/api/quotes', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  const body = (await c.req.json().catch(() => ({}))) as { title?: string }
  const title = body.title?.trim() || 'Untitled job'
  return c.json(await createQuote(c.env.DB, contractorId, title), 201)
})

app.get('/api/quotes/:id', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  const quote = await getQuote(c.env.DB, contractorId, c.req.param('id'))
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

app.patch('/api/quotes/:id', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  const patch = (await c.req.json()) as QuotePatch
  const quote = await updateQuote(c.env.DB, contractorId, c.req.param('id'), patch)
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

app.delete('/api/quotes/:id', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)
  await deleteQuote(c.env.DB, contractorId, c.req.param('id'))
  return c.json({ ok: true })
})

app.put('/api/quotes/:id/items', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const quoteId = c.req.param('id')
  // Confirms the quote belongs to this contractor before anything is written to it.
  if (!(await getQuote(c.env.DB, contractorId, quoteId))) {
    return c.json({ error: 'Not found' }, 404)
  }

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

  const quote = await replaceLineItems(c.env.DB, contractorId, quoteId, clean)
  return quote ? c.json(quote) : c.json({ error: 'Not found' }, 404)
})

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

app.put('/api/quotes/:id/rooms', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const quoteId = c.req.param('id')
  if (!(await getQuote(c.env.DB, contractorId, quoteId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const body = (await c.req.json()) as { rooms: RoomInput[] }
  if (!Array.isArray(body.rooms)) return c.json({ error: 'rooms must be an array' }, 400)

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

  const clean = body.rooms.slice(0, 60).map((room) => ({
    name: String(room.name ?? '').slice(0, 120) || 'Room',
    wallSqft: num(room.wallSqft),
    ceilingSqft: num(room.ceilingSqft),
    trimLinft: num(room.trimLinft),
    // At least one coat, capped so a typo cannot multiply a quote out of all recognition.
    coats: Math.min(5, Math.max(1, Math.round(num(room.coats)) || 1)),
  }))

  await replaceRooms(c.env.DB, quoteId, clean)
  const quote = await getQuote(c.env.DB, contractorId, quoteId)
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
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const quoteId = c.req.param('id')
  if (!(await getQuote(c.env.DB, contractorId, quoteId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const contentType = c.req.header('content-type') ?? ''
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return c.json({ error: 'Unsupported image type' }, 415)
  }

  const bytes = await c.req.arrayBuffer()
  if (bytes.byteLength === 0) return c.json({ error: 'Empty upload' }, 400)
  if (bytes.byteLength > PHOTO_MAX_BYTES) return c.json({ error: 'Image too large' }, 413)

  const width = Number.parseInt(c.req.query('w') ?? '', 10)
  const height = Number.parseInt(c.req.query('h') ?? '', 10)

  const extension =
    contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
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
 * Streams the object out of R2. Deliberately unauthenticated, like the public quote
 * itself: the random photo id is the credential, and a customer opening a quote link has
 * to be able to load the images without an account.
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
      ETag: object.httpEtag,
    },
  })
})

app.delete('/api/photos/:id', async (c) => {
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const row = await getPhotoRow(c.env.DB, c.req.param('id'))
  if (!row) return c.json({ error: 'Not found' }, 404)

  // Reading a photo is open, but destroying one must not be, so check the owning quote.
  if (!(await getQuote(c.env.DB, contractorId, row.quoteId))) {
    return c.json({ error: 'Not found' }, 404)
  }

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
  const contractorId = await requireContractor(c)
  if (!contractorId) return c.json(unauthorized, 401)

  const quote = await getQuote(c.env.DB, contractorId, c.req.param('id'))
  if (!quote) return c.json({ error: 'Not found' }, 404)

  if (quote.photos.length === 0 && !quote.title.trim() && !quote.notes?.trim()) {
    return c.json({ error: 'Add a photo or describe the job first.' }, 400)
  }

  const fetched = await Promise.all(
    quote.photos.slice(0, MAX_PHOTOS_ANALYSED).map(async (photo) => {
      const row = await getPhotoRow(c.env.DB, photo.id)
      if (!row) return null
      const object = await c.env.PHOTOS.get(row.r2Key)
      if (!object) return null
      return { bytes: await object.arrayBuffer(), contentType: row.contentType }
    }),
  )

  const priceBook = await listPriceBook(c.env.DB, contractorId)

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
    photoIds: quote.photos.map((p) => p.id),
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
