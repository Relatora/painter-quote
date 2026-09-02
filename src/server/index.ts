import { Hono } from 'hono'

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
  c.json({
    ok: true,
    demoMode: c.env.DEMO_MODE === '1',
    aiTier: c.env.AI_TIER,
  }),
)

// Requests that reach the Worker but match no API route fall through to the static
// asset handler configured in wrangler.jsonc, which serves the built client.
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

export default app
