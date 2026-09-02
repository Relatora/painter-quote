import type { ScopeAnalysis, ScopeItem, Confidence } from '../../shared/types'
import { buildScopePrompt, SCOPE_SCHEMA } from './prompt'

export interface AnalyzeInput {
  description: string
  /** Raw image bytes with their MIME types, already downscaled by the client. */
  photos: Array<{ bytes: ArrayBuffer; contentType: string }>
  /** The contractor's own price book names, so the model maps onto real entries. */
  priceBookNames: string[]
}

export interface VisionProvider {
  analyzeJob(input: AnalyzeInput): Promise<ScopeAnalysis>
}

export interface AiEnv {
  DEMO_MODE: string
  AI_TIER: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
}

/**
 * Chooses the provider for this request.
 *
 * Falls back to the offline stub whenever DEMO_MODE is on or no key is configured, so the
 * app is always usable: a missing key degrades the feature rather than breaking the app,
 * and a demo in front of a contractor never depends on a live API call succeeding.
 */
export function getVisionProvider(env: AiEnv): VisionProvider {
  if (env.DEMO_MODE === '1' || !env.GEMINI_API_KEY) return demoProvider()
  return geminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || DEFAULT_MODEL)
}

/**
 * Free tier covers the Flash class. Overridable with the GEMINI_MODEL var so a model
 * rename never needs a code change. Free and paid differ only by billing on the Google
 * Cloud project: same key format, same endpoint, same request.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

function geminiProvider(apiKey: string, model: string): VisionProvider {
  return {
    async analyzeJob({ description, photos, priceBookNames }) {
      const parts: unknown[] = [{ text: buildScopePrompt(description, priceBookNames) }]

      for (const photo of photos) {
        parts.push({
          inline_data: { mime_type: photo.contentType, data: toBase64(photo.bytes) },
        })
      }

      const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SCOPE_SCHEMA,
            // Scoping is a judgement task, not a creative one. Low temperature keeps
            // repeated analyses of the same job consistent.
            temperature: 0.2,
          },
        }),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new VisionError(describeFailure(res.status), res.status, detail.slice(0, 500))
      }

      const body = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new VisionError('The model returned an empty response.', 502)

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new VisionError('The model returned a response we could not read.', 502)
      }

      return { ...normalize(parsed, priceBookNames), demo: false }
    },
  }
}

export class VisionError extends Error {
  readonly status: number
  readonly detail?: string

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.name = 'VisionError'
    this.status = status
    this.detail = detail
  }
}

/** Messages a contractor can act on, rather than a raw upstream status. */
function describeFailure(status: number): string {
  if (status === 429) return 'The free AI quota is used up for now. Try again shortly.'
  if (status === 401 || status === 403) return 'The AI key was rejected. Check the configuration.'
  if (status >= 500) return 'The AI service is having trouble. Try again shortly.'
  return 'The AI could not read this job.'
}

/**
 * Trusts nothing from the model.
 *
 * Structured output makes the shape likely, not guaranteed, and a malformed field must
 * not reach the UI. Any priceBookName the model invented is dropped to null rather than
 * matched loosely, because a wrong mapping silently attaches the wrong rate to a line.
 */
function normalize(raw: unknown, priceBookNames: string[]): Omit<ScopeAnalysis, 'demo'> {
  const known = new Set(priceBookNames)
  const source = (raw ?? {}) as Record<string, unknown>

  const items = (value: unknown): ScopeItem[] =>
    (Array.isArray(value) ? value : [])
      .map((entry): ScopeItem | null => {
        const item = (entry ?? {}) as Record<string, unknown>
        const label = typeof item.label === 'string' ? item.label.trim() : ''
        if (!label) return null

        const name = typeof item.priceBookName === 'string' ? item.priceBookName.trim() : ''
        const confidence = item.confidence
        return {
          label: label.slice(0, 200),
          priceBookName: known.has(name) ? name : null,
          confidence: isConfidence(confidence) ? confidence : 'low',
          reason: typeof item.reason === 'string' ? item.reason.trim().slice(0, 400) : '',
        }
      })
      .filter((item): item is ScopeItem => item !== null)
      .slice(0, 40)

  return {
    surfaces: items(source.surfaces),
    conditions: items(source.conditions),
    uncertainties: (Array.isArray(source.uncertainties) ? source.uncertainties : [])
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim().slice(0, 300))
      .slice(0, 10),
  }
}

const isConfidence = (v: unknown): v is Confidence =>
  v === 'high' || v === 'medium' || v === 'low'

/** Chunked to avoid blowing the argument limit on a large image. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Offline stub used whenever DEMO_MODE is on or no key is set.
 *
 * Returns a realistic bathroom repaint so the whole flow can be built and demonstrated
 * with no API key, no quota burn, and no network. It maps onto seeded price book names,
 * so the suggestions become real line items exactly as a live response would.
 */
function demoProvider(): VisionProvider {
  return {
    async analyzeJob({ priceBookNames }) {
      const known = new Set(priceBookNames)
      const only = (name: string) => (known.has(name) ? name : null)

      return {
        surfaces: [
          {
            label: 'Repaint the bathroom walls',
            priceBookName: only('Interior walls'),
            confidence: 'high',
            reason: 'Painted drywall visible on all sides of the room.',
          },
          {
            label: 'Repaint the ceiling',
            priceBookName: only('Ceilings'),
            confidence: 'medium',
            reason: 'Ceiling shares the room but was not clearly shown. Confirm it is included.',
          },
          {
            label: 'Repaint door and casing',
            priceBookName: only('Doors'),
            confidence: 'high',
            reason: 'One painted door with casing is in frame.',
          },
        ],
        conditions: [
          {
            label: 'Patch and sand before coating',
            priceBookName: only('Patch and sand'),
            confidence: 'high',
            reason: 'Nail holes and a small dent visible above the towel bar.',
          },
          {
            label: 'Re-caulk around the tub surround',
            priceBookName: only('Caulking'),
            confidence: 'high',
            reason: 'Existing caulk line is split and discoloured where the wall meets the tub.',
          },
          {
            label: 'Spot prime the water stain',
            priceBookName: only('Priming'),
            confidence: 'medium',
            reason: 'Discolouration near the ceiling will bleed through paint unless sealed.',
          },
          {
            label: 'Mask fixtures and protect floor',
            priceBookName: only('Masking and protection'),
            confidence: 'high',
            reason: 'Vanity, mirror, and tiled floor all need covering in a room this tight.',
          },
        ],
        uncertainties: [
          'The source of the ceiling stain is not visible. If it is an active leak, it needs fixing before painting.',
          'Whether the vanity and trim are included could not be determined from the photos.',
        ],
        demo: true,
      }
    },
  }
}
