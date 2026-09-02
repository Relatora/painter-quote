/**
 * Stateless signed session cookies.
 *
 * There is no session table on purpose. A signed cookie carrying the contractor id and an
 * expiry needs no storage, no lookup on every request, and no cleanup job. The tradeoff is
 * that a session cannot be revoked server side before it expires, which is why the
 * lifetime is bounded rather than indefinite.
 */

export const SESSION_COOKIE = 'pq_session'

/** Thirty days. Long enough that a painter is not signed out between jobs. */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

interface SessionPayload {
  /** Contractor id. */
  sub: string
  /** Expiry, seconds since epoch. */
  exp: number
}

const encoder = new TextEncoder()

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** base64url, because a cookie value may not contain +, / or =. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function createSession(contractorId: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    sub: contractorId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${toBase64Url(new Uint8Array(signature))}`
}

/**
 * Returns the contractor id, or null for anything that is not a currently valid session.
 *
 * Verification happens before parsing, so a tampered payload is never even read. Signature
 * comparison uses crypto.subtle.verify rather than string equality, which keeps it
 * constant time.
 */
export async function readSession(token: string, secret: string): Promise<string | null> {
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  let valid: boolean
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    )
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload.sub
  } catch {
    return null
  }
}

export function sessionCookie(value: string, secure: boolean): string {
  // HttpOnly keeps it away from scripts, SameSite=Lax still allows the magic link
  // navigation from an email client to arrive with the cookie set.
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearedCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/* ---------------------------------------------------------------------------
   Magic link tokens
   --------------------------------------------------------------------------- */

/** 256 bits from the CSPRNG. Long enough that guessing is not a threat model. */
export function createLoginToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toBase64Url(bytes)
}

/**
 * Hashes a login token for storage.
 *
 * Only the hash is persisted, so reading the database does not yield a working link.
 * A plain SHA-256 is right here rather than a password hash: the token is 256 bits of
 * random, so there is no low entropy secret for an attacker to brute force.
 */
export async function hashLoginToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Normalises an email for identity comparison. Case and surrounding space are noise. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Deliberately permissive. The confirmation is the email arriving, not a regex. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}
